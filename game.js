var Player = function(socket,id){
	this.socket = socket;
	this.id = id;
	this.disconnected = false;
	this.name = '';
}
var Players = {
	players:[],

	add : function(p){
		this.players.push(p);
	},

	remove : function(p){
		var idx = this.players.indexOf(p);
		if(idx>=0){
			this.players.splice(idx,1);
		}
	},
	getById : function(id){
		for(var i in this.players){
			var p = this.players[i];
			if(p.id == id){
				return p;
			}
		}
		return null;
	}
}

var Game = function(io){

	var players = [];
	var DISCONNET_TIME_LIMIT = 10000;


	io.sockets.on('connection', function (socket) {

		// registration
		socket.on('register', function (data) {
			if (data !== null) {
				var player = Players.getById(data.id);
				var registerSuccess = false;
				if (player===null) {
					// no existing player
					if(data.name){
						player = new Player(socket,data.id);
						player.name = data.name;
						Players.add(player);
						registerSuccess = true;
					}else{
						registerSuccess = false;
					}

				}else{
					// has existing player
					registerSuccess = true;
					player.disconnected = false;
				}

				if(registerSuccess){
					socket.on('disconnect', function () {

						player.disconnected = true;
						setTimeout(function () {
							if (player.disconnected){
								Players.remove(player);
							}
							
						}, DISCONNET_TIME_LIMIT);
		

					});
					
					socket.emit('register',{
						id:player.id,
						name:player.name
					});
				}

			}
		});





	});
}
module.exports = Game;

