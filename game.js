var Player = function(socket,id){
	var $this = this;
	this.socket = socket;
	this.id = id;
	this.disconnected = false;
	this.name = '';

	this.getInfo = function(){
		return {
			id:$this.id,
			name:$this.name,
			disconnected:$this.disconnected,
			inGame:$this.isInGame()
		}
	}
	this.isInGame = function(){
		return this.getGameSession()!==null;
	}
	this.getGameSession = function(){
		for(var i in MatchMaking.game_sessions){
			var sess = MatchMaking.game_sessions[i];
			for(var j in sess.players){
				var p = sess.players[j];
				if(p==this)
					return sess;
			}
		}
		return null;
	}
}
var GameSession = function(players){
	var $this = this;
	this.players = players;
	this.turn = 0;


	this.sendGameSessionInfo = function(){
		for(var i in this.players){
			var p = this.players[i];
			p.socket.emit('game_session_info',{
				isTurn:i==$this.turn
			});
		}
	}

	this.end = function(){
		var idx = MatchMaking.game_sessions.indexOf(this);
		if(idx>=0){
			MatchMaking.game_sessions.splice(idx,1);
		}
	}

		for(var i in this.players){
			var p = this.players[i];
			p.socket.emit('game_start',{});
		}

	this.sendGameSessionInfo();
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

var MatchMaking = {
	pool:[],
	game_sessions:[],
	isMatching:false,
	add:function(player){

		if (!player.isInGame() && this.pool.indexOf(player) < 0){
			
			this.pool.push(player);
			this.matchPlayers();
		}
	},
	remove:function(player){
		var idx = this.pool.indexOf(player);
		if(idx>=0)
			pool.splice(idx,1);
	},
	matchPlayers:function(){

		if(this.isMatching) return;

		this.isMatching = true;

		// while in pars
		while(this.pool.length>1){
			this.createGameSession(this.pool.pop(),this.pool.pop());
		}

		this.isMatching = false;

	},
	createGameSession:function(p1,p2){
		
		p1.socket.emit('match_found',{
			enemy: p2.getInfo()
		});
		p2.socket.emit('match_found',{
			enemy: p1.getInfo()
		});

		this.game_sessions.push(new GameSession([p1,p2]));
	}
}

var Game = function(io){

	var players = [];
	var DISCONNET_TIME_LIMIT = 10000;
	var onRegister = function(socket){
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
					player.socket = socket;
					registerSuccess = true;
					player.disconnected = false;
				}

				if(registerSuccess){

					onFindMatch(player);
					socket.on('disconnect', function () {
						MatchMaking.remove(player);
						player.disconnected = true;
						setTimeout(function () {
							if (player.disconnected){
								player.getGameSession().end();
								Players.remove(player);
							}
							
						}, DISCONNET_TIME_LIMIT);
		

					});
					
					socket.emit('register',player.getInfo());
				}
				
			}
		});
	}

	var onFindMatch = function(player){
		player.socket.on('find_match',function(data){
			MatchMaking.add(player);
		});

		
	}

	io.sockets.on('connection', function (socket) {
		onRegister(socket);
		

	});
}
module.exports = Game;

