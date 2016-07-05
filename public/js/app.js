$(function() {
	$('#search').keydown(function(event) {
		if (event.keyCode == 13) {
			this.form.submit();
			return false;
		}
	});

	// http://stackoverflow.com/questions/19192747/how-to-dynamically-change-themes-after-clicking-a-drop-down-menu-of-themes

	var themes = {
		"cerulean" : "/themes/cerulean.css",
		"cosmo" : "/themes/cosmo.css",
		"cyborg" : "/themes/cyborg.css",
		"darkly" : "/themes/darkly.css",
		"default": "/themes/default.css",
		"flatly" : "/themes/flatly.css",
		"journal" : "/themes/journal.css",
		"lumen" : "/themes/lumen.css",
		"paper" : "/themes/paper.css",
		"readable" : "/themes/readable.css",
		"sandstone" : "/themes/sandstone.css",
		"simplex" : "/themes/simplex.css",
		"slate" : "/themes/slate.css",
		"spacelab" : "/themes/spacelab.css",
		"superhero" : "/themes/superhero.css",
		"united" : "/themes/united.css",
		"yeti" : "/themes/yeti.css"
	};

	var themesheet = $('<link href="'+themes['default']+'" rel="stylesheet" />');
	themesheet.appendTo('head');
	$('.theme-link').click(function(){
		var themeurl = themes[$(this).attr('data-theme')]; 
		themesheet.attr('href',themeurl);
	});

});