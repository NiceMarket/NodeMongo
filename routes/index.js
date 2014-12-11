exports.login = function(req, res){
	if (req.body.email === 'user' && req.body.password === '1234') {
		req.session.user = 'user';
		res.redirect('/');
	} else
		res.send('Account or password error.');
};

exports.index = function(req, res){
  res.render('index', {
		title : 'BaskClub',
		req : req
	});
};