var express = require('express');
var path = require('path');

var app = express();

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'articleImgs')));

// Start Server

app.listen(process.env.PORT || '3000', function () {
  console.log('Server started on port: ' + this.address().port);
});

// Define local varialbes

app.locals.urlBase = 'http://localhost:3000';
app.locals.siteName = 'The Clarion';
app.locals.categories = [ 'News', 'Opinions', 'Entertainment', 'Features', 'Sports' ];
app.locals.theme = 'journal';

// Import Libraries

var Datastore = require('nedb');
var db = new Datastore('./main.db');
db.loadDatabase();

var multipart = require('connect-multiparty');
var multipartMiddleware = multipart();

var querystring = require('querystring');
var multer = require('multer');
var storage = multer.diskStorage({
  destination: function (req, file, cb) { cb(null, 'articleImgs/'); },
  filename: function (req, file, cb) { cb(null, req.params.id + '-' + querystring.escape(file.originalname)); }
});
var upload = multer({ storage: storage });

var shortid = require('shortid');

var fs = require('fs');
var _ = require('underscore');

var Cookies = require('cookies');
var jwt = require('jsonwebtoken');
var secret = "lololol";

var LineByLineReader = require('line-by-line');
var Parser = require("simple-text-parser");
var parser = new Parser();

// Public Functions

app.get('/article/:category/:title', function (req, res) {
  var category = querystring.escape(req.params.category.toLowerCase());
  var title = querystring.escape(req.params.title.toLowerCase());
  db.findOne({ urlCategory: category, urlTitle: title }, function (err, article) {
    if (err) { res.json(err); }
    else {
      if (article) {
        try {
          var content = fs.readFileSync('articleText/' + article.id).toString();
          article.content = parseContent(article.id, content);
          article.headerImg = article.id + '-' + article.headerImg;
          res.render('article', { article: article });
        } catch (err) { res.send("Error"); }
      } else { res.send("Error"); }
    }
  });
});

app.get('/category/:category', function (req, res) {
  var category = querystring.escape(req.params.category.toLowerCase());
  db.find({ urlCategory: category }, function (err, articles) {
    if (err) { res.json(err); }
    else { 
      res.render('articles_list', { 
        articles: articles, 
        title: 'in ' + category 
      }); 
    }
  });
});

app.get('/author/:author', function (req, res) {
  var author = querystring.escape(req.params.author.toLowerCase());
  db.find({ urlAuthor: author }, function (err, articles) {
    if (err) { res.json(err); }
    else { 
      res.render('articles_list', { 
        articles: articles, 
        title: 'from ' + author
      }); 
    }
  });
});

app.post('/search', multipartMiddleware, function (req, res) {
  var query = req.body.query;
  var regex = new RegExp('.*' + query + '.*');
  var params = { $or: [ 
    { title: { $regex: regex } }, 
    { category: { $regex: regex } }, 
    { author: { $regex: regex } } ] 
  };
  db.find(params, function (err, articles) {
    if (err) { res.json(err); }
    else { 
      res.render('articles_list', { 
        articles: articles, 
        title: 'with ' + query
      });
    }
  });
});

// Editor Functions

app.use('/editor', function(req, res, next) {
  if (req.originalUrl == '/editor/login') { next(); }
  else {
    var cookies = new Cookies(req, res);
    var token = cookies.get('token');
    if (authorized(token)) next();
    else res.send('NOT AUTHORIZED');
  }
});

app.get('/editor/login', function (req,res,next) {
  var cookies = new Cookies(req, res);
  var token = cookies.get('token');
  if (authorized(token)) res.send('Logged In');
  else res.render('login', {});
});

app.post('/editor/login', multipartMiddleware, function( req, res, next ) {
  var user = req.body;
  var approved = require('./approved.json').approved;
  var cookies = new Cookies(req, res);
  var found = _.find(approved, function (u) { 
    return u.name == user.name && u.pass == user.pass; 
  });
  if (found) {
    var token = jwt.sign({ name: user.name, pass: user.pass }, secret);
    cookies.set('token', token);
    res.status(200).send("Logged In");
  } else {
    res.status(200).send("You are not an approved editor");
  }
});

app.get('/editor/logout', function( req, res, next ) {
  var cookies = new Cookies(req, res);
  cookies.set('token');
  res.redirect('/editor/login');
});

app.get('/editor/newArticle', function (req, res) {
  var id = shortid.generate();
  res.render('add_article', { 
    article: { 
      id: id,  title: '',  author: '', category: '', 
      datePublished: '', headerImg: '', content: ''
    }
  });
});

app.post('/editor/newArticle/:id', multipartMiddleware, function (req, res) {
  var article = req.body.article;
  var id = req.params.id;
  fs.writeFileSync('articleText/' + id, article.content);
  delete article.content;
  var data = articlePutParams(id, article);
  db.findOne({ id: id }, function (err, article) {
    if (_.isEmpty(article)) {
      db.insert(data, function (err, newDoc) {
        if (err) { res.json(err); }
        else { res.redirect('/article/' + data.urlCategory + '/' + data.urlTitle); }
      });
    } else {
      db.update({ id: id }, data, {}, function (err) {
        if (err) { res.json(err); }
        else { res.redirect('/article/' + data.urlCategory + '/' + data.urlTitle); }
      });
    }
  });
});

app.get('/editor/editArticle/:category/:title', function (req, res) {
  var category = querystring.escape(req.params.category);
  var title = querystring.escape(req.params.title);
  db.findOne({ urlCategory: category, urlTitle: title }, function (err, article) {
    if (err) { res.json(err); }
    else {
      if (article) {
        var content = fs.readFileSync('articleText/' + article.id).toString();
        article.content = content; // assumes content exists for all articles
        res.render('add_article', { article: article });
      } else { res.send("Error"); }
    }
  });
});

app.get('/editor/directory', function (req, res) {
  db.find({}, function (err, articles) {
    if (err) { res.json(err); }
    else { res.render('directory', { articles: articles }); }
  });
});

app.post('/editor/upload/:id', upload.single('file'), function( req, res, next ) {
  res.status( 200 ).send("ALL GOOD DAWG");
});

// Parser

/*
  image: [ imagename.type, image caption ] --> /articleImgs/id-imagename.type
  header: { header content } --> <h2>header content</h2>
  */

  parser.addRule(/\[(.*?)\]/, function(tag) {
    var data = tag.replace(/[[\]]/g,'').split(',');
    return "<br><figure><img class='img-responsive' src='/" 
    + data[0].trim() + "'><figcaption>" 
    + data[1].trim() + "</figcaption></figure><br>";
  });
  parser.addRule(/\{(.*?)\}/, function(tag) {
    return "<h2>" + tag.replace(/[{}]/g,'').trim() + "</h2>";
  });
  function parseContent(id, content) {
  // takes [ imagename.type  ] and turns it into [id-imagename.type]
  var text = content.trim().replace(/\[\s*(.*?)\s*]/g, '[$1]').replace(/\[/g,"[" + id + "-");
  var html = parser.render(text);
  return html;
}

// Helper Functions

function deleteFile(yes, path) {
  if (yes) {
    fs.unlink(path, function(err) {
      if (err) console.log(err);
    });  
  }
}

// use this client side
function noNullVals(obj) {
  var empty = [];
  if (_.isEmpty(obj))
    empty.push(null);
  for (var key in obj) {
    if (obj[key] == null || obj[key] == "")
      empty.push(key);
  }
  return empty;
}

function extractData(obj) {
  var article = {};
  for (var key in obj) {
    article[key] = obj[key].S;
  }
  return article;
}

function linkify(str) {
  return querystring.escape(str.trim().replace(/\s+/g, '-').toLowerCase());
}

function sortByDate(data, attribute) {
  return _.sortBy(data, function(item) {
    return new Date(item[attribute]).getTime();
  }).reverse();
}

function authorized(token) {
  try {
    var user = jwt.verify(token, secret);
    var approved = require('./approved.json').approved;
    var found = _.find(approved, function (u) { 
      return u.name == user.name && u.pass == user.pass; 
    });
    if (found) return true;
    else return false;
  } catch(err) {
    return false;
  }
}

function articlePutParams(id, article) {
  return {
    id: id,
    title: article.title,
    author: article.author,
    category: article.category,
    datePublished: article.date,
    dateNum: new Date(article.date).getTime(),
    headerImg: article.headerImg,
    urlTitle: linkify(article.title),
    urlCategory: linkify(article.category),
    urlAuthor: linkify(article.author)
  };
};

// TODO: Error handling
// TODO, paginate results from category, author, and search
// TODO, prevent empty arguments in article put ON CLIENT SIDE
// Optimize db, use find or findOne when applicable
// ALLOW config option backup = true | false
// If true, backup files to AWS, Github, or Google Drive
// Then, have data backed up from providers on relaunch
// On relaunch, reinitialize database and files in directory
// To allow for better querying and stuff
// For search, make index?

// TODO, make article content searchable too via db

module.exports = app;
