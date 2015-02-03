var app = angular.module('game',['ngRoute','btford.socket-io']);

// ROUTES
app.config(function($routeProvider, $locationProvider) {
	$routeProvider.when('/', {
		templateUrl: 'part/splash',
		controller: 'SplashCtrl'
	});

	$routeProvider.when('/login', {
		templateUrl: 'part/login',
		controller: 'LoginCtrl'
	});

	$routeProvider.when('/lobby', {
		templateUrl: 'part/lobby',
		controller: 'LobbyCtrl'
	});
	$routeProvider.when('/game-setup', {
		templateUrl: 'part/game-setup',
		controller: 'GameSetupCtrl'
	});
});



// SERVICES
app.factory('GameSocket', function (socketFactory) {
	var socket = socketFactory();
	// forward messages as angular events
	socket.forward('match_found');
	socket.forward('register');
	socket.forward('game_session_info');
	socket.forward('game_command');
	socket.forward('player_ready_info');


	socket.sendCommand = function(){
		this.emit('game_command',arguments);
	}


	return socket;
});
app.factory('GameState',function(Player,$location,GameSocket){
	var gs = {
		state:'splash',
		connected:false,
		inGame:false,
		isGameReady:false,
		enemy:{}
	};

	var obj = {
		check:function(){
			if(!this.isConnected){
				this.setState('splash');
			}else if(!Player.hasName()){
				this.setState('login');
			}else if(gs.inGame){
				this.setState('game-setup');
			}else if(Player.hasName()){
				this.setState('lobby');
			}
			$location.path(this.getState());
		},
		getState:function(){return gs.state;},
		setState:function(s){gs.state = s;},
		getEnemy:function(){return gs.ememy;},
		setEnemy:function(e){gs.ememy = e;},
		setInGame:function(i){gs.inGame = i;},
		isInGame:function(){return gs.inGame;},
		setGameReady:function(i){gs.isGameReady = i;},
		isGameReady:function(){return gs.isGameReady;},
		isConnected:function(){return gs.connected;}
	};
	GameSocket.on('connect',function(){
		gs.connected = true;
		obj.check();
	});


	GameSocket.on('game_start',function(data){
		obj.setInGame(true);
		obj.check();
	});
	GameSocket.on('game_end',function(data){
		obj.setInGame(false);
		obj.check();
	});

	return obj;
});

app.factory('Player',function(){

	return {
		id:Number(localStorage.getItem('userId')) || null,
		name:'',
		getId:function(){return this.id;},
		setId:function(i){ 
			this.id = i;
			if(this.id)
				localStorage.setItem('userId',this.id);
		},
		createId:function(){
			var i = new Date().getTime();
			this.setId(i);
			return this.getId();
		},
		getName:function(){return this.name;},
		setName:function(n){ this.name = n;},
		hasName:function(){ return !!this.name;}
	};
});




// CONTROLLERS
app.controller('SplashCtrl',function($scope,GameState){
	GameState.check();
});
app.controller('LoginCtrl',function($scope,Player,GameState,GameSocket){
	GameState.check();
	$scope.login = {
		name:'',
		submit:function(){
			if(this.name){
				Player.setName(this.name);
				$scope.register();
			}

		}
	}
	$scope.$on('socket:register',function(e,data){
		Player.setId(data.id);
		Player.setName(data.name);
		GameState.setInGame(data.inGame);
		GameState.check();
	});
	$scope.register = function(){
		var id = Player.getId() || Player.createId();
		
		var data = {id:id,name:Player.getName()};
		GameSocket.emit('register',data);
	}
	if(Player.getId()){
		$scope.register();
	}


});

app.controller('LobbyCtrl',function($scope,GameState,GameSocket){
	GameState.check();
	$scope.findMatch = function(){
		GameSocket.emit('find_match');
	}
	$scope.$on('socket:match_found',function(e,data){
		//GameState.setEnemy(data.enemy);
	});

});

app.controller('GameSetupCtrl',function($scope,GameState,GameSocket){
	GameState.check();

	$scope.pieces = [];
	$scope.board = [];
	$scope.playerReady = false;
	$scope.enemyReady = false;
	$scope.setupHand = null;
	$scope.settedUp = [];

	$scope.initialize = function(){
		$scope.initBoard();
		GameSocket.emit('get_game_session',{});
	};
	$scope.initBoard = function(){
		var id = 1;
		$scope.board.length = 0;
		for(var i=0;i<8;i++){
			$scope.board[i] = [];
			for(var j=0;j<9;j++){
				$scope.board[i][j] = {
					id:id,
					x:j,
					y:i,
					setupArea:i>4,
					piece:null
				};
				id++;
			}
		}
	}

	$scope.isSetupArea = function(cell){
		return !cell.setupArea;
	}
	$scope.setupHold = function(p){
		if(p.yours)
			$scope.setupHand = p;
	}
	$scope.setupCell = function(cell){
		// put piece
		if(!$scope.isPieceSettedUp(cell.piece)){
			if($scope.setupHand!==null){

				// check if it exists on board and remove if it does
				for(var i=0;i<8;i++){
					for(var j=0;j<9;j++){
						if($scope.board[i][j].piece===$scope.setupHand){
							$scope.board[i][j].piece = null;
							break;
						}
					
					}
				}

				var fromX = $scope.setupHand.x;
				var fromY = $scope.setupHand.y;
				// change coordinates if piece on hand
				$scope.setupHand.x = cell.x;
				$scope.setupHand.y = cell.y;
				// put piece on cell
				cell.piece = $scope.setupHand;
				// flag as setted
				if(!$scope.isPieceSettedUp(cell.piece))
					$scope.settedUp.push(cell.piece);
				// send command
				GameSocket.sendCommand('piece_setup',{
					fromX:fromX,
					fromY:fromY,
					toX:$scope.setupHand.x,
					toY:$scope.setupHand.y,
					id:$scope.setupHand.id,
				});
				// remove piece from hand
				$scope.setupHand = null;


			}
		}else if(cell.piece!==null && $scope.setupHand===null){
			// pick up on board
			$scope.setupHand = cell.piece;
		}else if(cell.piece!==null && $scope.setupHand!==null){
			// change puck up
			$scope.setupHand = cell.piece;
		}

	}
	$scope.setupCellPreview = function(cell){
		if(cell.piece!=null){
			if(cell.piece.yours){
				return $scope.rankToName(cell.piece.rank);
			}else{
				return '???';
			}
			
		}else{
			return '';
		}
		
	}

	$scope.isCellPieceIsYours = function(cell,noCellValue){
		if(cell.piece!=null){
			return cell.piece.yours;
		}else{
			return noCellValue || false;
		}
		
	}
	$scope.isPieceSettedUp = function(p){
		return $scope.settedUp.indexOf(p)>=0;
	}
	$scope.rankToName = function(rank){
		rank = Number(rank);
		var names = ['Flag','Spy','Pvt.','Sgt.','2nd Lt.','1st Lt.','Cap.','Maj.','Lt. Col.','Col.','*','**','***','****','*****'];
		if(rank>0 && rank<=names.length){
			return names[rank-1];
		}else{
			return rank;
		}
	};
	$scope.isPlayerReady = function(){
		var unplaced = 0;
		for(var p in $scope.pieces){
			if($scope.pieces[p].yours===false) continue;
			if(!$scope.isPieceSettedUp($scope.pieces[p])){
				unplaced++;
			}
		}

		return unplaced==0;
	}

	$scope.setReady = function(val){
		GameSocket.sendCommand('player_ready',{isReady:true});
	}

	$scope.commands = {
		piece_setup:function(data){
			
			// get piece
			var p = null;
			for(var i in $scope.pieces){
				if($scope.pieces[i].id==data.id){
					p = $scope.pieces[i];
					break;
				}
				
			}
			if(p==null) return;
			// remove piece form orig cell
			if(p.x!==null && p.y!==null) $scope.board[p.y][p.x].piece = null;
			// move to new cell
			if(data.toX!==null && data.toY!==null){
				console.log('setup piece',data);
				$scope.board[data.toY][data.toX].piece = p;
			}

			// remove from old cell
			if(data.fromX!==null && data.fromY!==null){
				console.log('setup piece',data);
				$scope.board[data.fromY][data.fromX].piece = null;
			}
			// set flag
			if(!$scope.isPieceSettedUp(p))
				$scope.settedUp.push(p);



		}
	};
	$scope.runCommand = function(args){
		
		if(args.length<2) return;

		var method = args[0];
		var data = args[1];

		if($scope.commands.hasOwnProperty(method)){
			$scope.commands[method](data);
			if(!$scope.$$phase) $scope.$apply();
		}

	}
	$scope.$on('socket:player_ready_info',function(e,data){
		console.log('ready info',data);
	});

	$scope.$on('socket:game_session_info',function(e,data){
		$scope.pieces.length = 0;
		angular.forEach(data.pieces,function(p){
			if(p.x!==null && p.y!==null){
				// flag as setted
				if(!$scope.isPieceSettedUp(p))
					$scope.settedUp.push(p);
				$scope.board[p.y][p.x].piece = p;
			}
				
			$scope.pieces.push(p);
		});
		$scope.playerReady = data.playerReady;
		$scope.enemyReady = data.enemyReady;
		
	});

	$scope.$on('socket:game_command',function(e,data){
		$scope.runCommand(data);
		
	});

	$scope.initialize();
});