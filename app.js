
/**
 * Module dependencies.
 */
var util = require('util');
var express = require('express');
var partials = require('express-partials');
var routes = require('./routes');
var gamedb = require('./database');
var http = require('http');
var path = require('path');
var app = express();
var WebSocketServer = require('./socketServer');

// all environments
app.set('port', process.env.PORT || 3100);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(express.bodyParser());
app.use(partials());
app.use(express.cookieParser());
app.use(express.session({secret: 'abc123'}));
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.json());
app.use(express.urlencoded());
app.use(express.methodOverride());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' === app.get('env')) {
  app.use(express.errorHandler());
}

app.get('/', routes.index);
app.post('/login', routes.login);

var httpServer = http.createServer(app).listen(app.get('port'), function(){
	console.log('Express server listening on port ' + app.get('port'));
});

httpServer.setMaxListeners(1024);