var http = require('http');
var jade = require('jade');
var express = require('express');
var config = require('./config');

var app = express();
var server = http.createServer(app);
var io = require('socket.io').listen(server);
var game = require('./game')(io);
// set view
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.set("view options", { layout: false });

// set static folder
app.use(express.static(__dirname + '/public'));

// routes
app.get('/', function(req, res){
	res.render('home.jade');
});
app.get('/part/splash', function(req, res){
	res.render('splash.jade');
});
app.get('/part/login', function(req, res){
	res.render('login.jade');
});
app.get('/part/lobby', function(req, res){
	res.render('lobby.jade');
});
app.get('/part/game-setup', function(req, res){
	res.render('game-setup.jade');
});














server.listen(config.server.port);

