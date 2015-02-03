var Player = function(socket,id){
	var $this = this;
	this.socket = socket;
	this.id = id;
	this.disconnected = false;
	this.name = '';

	this.setSocket = function(s){
		this.socket = s;
		this.registerSocket();
	}
	this.registerSocket = function(){
		this.socket.on('game_command',function(data){
			if($this.isInGame())
				$this.getGameSession().runCommand($this,data);
		});
	}
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

	this.registerSocket();



}
var GameSession = function(players){
	var $this = this;

	this.BOARD_ROWS = 8;
	this.BOARD_COLS = 9;

	this.players = players;
	this.turn = 0;

	this.ready = [false,false];

	this.pieces = [];

	this.getEnemy = function(p){
		if(this.players.indexOf(p)==0) {
			return this.players[1];
		}else{
			return this.players[0];
		}
	}
	this.isPlayerInverse = function(p){
		return this.players.indexOf(p)>0;
	}


	this.runCommand = function(player,args){
		
		if(this.players.indexOf(player)<0) return;
		if(args.length<2) return;

		var method = args[0];
		var data = args[1];

		if(this.commands.hasOwnProperty(method)){
			this.commands[method](data,player);
		}

	}
	this.sendCommand = function(player,method,data){
		player.socket.emit('game_command',[method,data]);
	}
	this.commands = {
		piece_setup:function(data){
			for(var i in $this.pieces){
				var p = $this.pieces[i];
				if(p.id == data.id){
					p.x = data.toX;
					p.y = data.toY;

					var enemy = $this.getEnemy(p.owner);

					if($this.isPlayerInverse(p.owner)){
						$this.invertPiece(p);
					}
					
					$this.sendCommand(enemy,'piece_setup',{
						id:data.id,
						fromX:$this.inverseX(data.fromX),
						fromY:$this.inverseY(data.fromY),
						toX:$this.inverseX(data.toX),
						toY:$this.inverseY(data.toY),
					});
					


					break;
				}

			}
		},
		player_ready:function(data,player){
			var idx = $this.players.indexOf(player);
			if(idx>=0 && data.isReady!==null){
				$this.ready[idx] = data.isReady;
			}
			for(var i in $this.players){
				$this.sendReadyInfo($this.players[i]);
			}
			


		}
	}

	this.sendReadyInfo = function(player){
		var idx = $this.players.indexOf(player);
		var me,enemy,data;
		if(idx==0){
			data = {
				me:$this.ready[0],
				enemy:$this.ready[1]
			};
		}else{
			data = {
				me:$this.ready[1],
				enemy:$this.ready[0]
			};
		}
		player.socket.emit('player_ready_info',data);
	}

	this.generatePiece = function(owner,rank){
		return {
			id:this.pieces.length+1,
			x:null,
			y:null,
			rank:rank,
			alive:true,
			owner:owner
		}
	}



	this.initGameData = function(){
		var ranks = [1,2,6,1,1,1,1,1,1,1,1,1,1,1,1];
		var rank = 1;
		this.pieces.length = 0;
		for(var r in ranks){
			var count = ranks[r];
			for(var i in this.players){
				var p = this.players[i];
				for(var j=0;j<count;j++)
					this.pieces.push(this.generatePiece(p,rank));
			}
			rank++;
		}
	}
	this.invertPiece = function(piece){
		if(piece.y!==null){
			piece.y = this.inverseY(piece.y);

		}
		if(piece.x!==null){
			piece.x = this.inverseX(piece.x);
		}
	}
	this.inverseX = function(x){
		//return x;
		if(x!==null)
			return this.BOARD_COLS-1-x;
		else
			return null;
	}
	this.inverseY = function(y){
		//return y;
		if(y!==null)
			return this.BOARD_ROWS-1-y;
		else
			return null;
	}
	this.getPieces = function(player){
		var isInverse = $this.isPlayerInverse(player);
		var pcs = [];
		for(var i in this.pieces){


			var piece = this.pieces[i];
			var x = piece.x;
			var y = piece.y;
			if(isInverse){ // invert if player 2
				if(piece.x!==null) x = $this.inverseX(piece.x);
				if(piece.y!==null) y = $this.inverseY(piece.y);
			}
			pcs.push({
				id:piece.id,
				x:x,
				y:y,
				rank:piece.rank,
				alive:piece.alive,
				yours:piece.owner==player,
			});
		}

		return pcs;

	}

	this.sendGameSessionInfo = function(){
		for(var i in this.players){
			this.sendPlayerSessionInfo(this.players[i]);
		}
	}

	this.sendPlayerSessionInfo = function(p){
			var i = this.players.indexOf(p);
			var enemy;
			var playerIdx,enemyIdx;
			if(i==0){
				playerIdx = 0;
				enemyIdx = 1;
				enemy = this.players[enemyIdx].getInfo();
			}else{
				playerIdx = 1;
				enemyIdx = 0;
				enemy = this.players[enemyIdx].getInfo();
			}

			p.socket.emit('game_session_info',{
				isTurn:i==$this.turn,
				enemy:enemy,
				pieces:$this.getPieces(p),
				playerReady:$this.ready[playerIdx],
				enemyReady:$this.ready[enemyIdx]
			});
	}

	this.initialize = function(){
		this.initGameData();
		this.sendGameStart();
		this.sendGameSessionInfo();
	}

	this.sendGameStart = function(){
		for(var i in this.players){
			var p = this.players[i];
			p.socket.emit('game_start',{});
		}
	}

	this.end = function(){
		var idx = MatchMaking.game_sessions.indexOf(this);
		if(idx>=0){
			MatchMaking.game_sessions.splice(idx,1);
		}
	}


	this.initialize();
	
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
			this.pool.splice(idx,1);
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
					// reconnect
					player.setSocket(socket);
					registerSuccess = true;
					player.disconnected = false;
				}

				if(registerSuccess){


					registerFindMatch(player);
					


					socket.on('disconnect', function () {
						MatchMaking.remove(player);
						player.disconnected = true;
						setTimeout(function () {
							if (player.disconnected){
								if(player.isInGame())
									player.getGameSession().end();
								Players.remove(player);
								console.log('10 second disconnect');
							}

							
						}, DISCONNET_TIME_LIMIT);
		

					});
					
					socket.emit('register',player.getInfo());
					registerGameSession(player);
				}
				
			}
		});
	}

	var registerFindMatch = function(player){
		player.socket.on('find_match',function(data){
			MatchMaking.add(player);
		});

		
	}
	var registerGameSession = function(player){
		player.socket.on('get_game_session',function(data){
			if(player.isInGame()){

				player.getGameSession().sendPlayerSessionInfo(player);
			}
		});

		
	}

	io.sockets.on('connection', function (socket) {
		onRegister(socket);
		

	});
}
module.exports = Game;

