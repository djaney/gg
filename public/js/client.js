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
	$routeProvider.when('/game', {
		templateUrl: 'part/game',
		controller: 'GameCtrl'
	});
});



// SERVICES
app.factory('GameSocket', function (socketFactory) {
	var socket = socketFactory();
	socket.forward('match_found');
	socket.forward('register');
	socket.forward('game_session_info');
	socket.forward('game_command');


	return socket;
});
app.factory('GameState',function(Player,$location,GameSocket){
	var gs = {
		state:'splash',
		connected:false,
		inGame:false,
		enemy:{}
	};

	var obj = {
		check:function(){
			if(!this.isConnected){
				this.setState('splash');
			}else if(!Player.hasName()){
				this.setState('login');
			}else if(gs.inGame){
				this.setState('game');
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

app.controller('GameCtrl',function($scope,GameState,GameSocket){
	GameState.check();

	$scope.pieces = [];
	$scope.board = [];
	$scope.playerReady = false;
	$scope.enemyReady = false;
	$scope.setupHand = null;
	$scope.settedUp = [];
	$scope.sendCommand = function(){
		GameSocket.emit('game_command',arguments);
	}

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
	$scope.setupPut = function(cell){

		if(!$scope.isPieceSettedUp(cell.piece)){
			if($scope.setupHand!==null){
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
				$scope.sendCommand('piece_setup',{
					fromX:fromX,
					fromY:fromY,
					toX:$scope.setupHand.x,
					toY:$scope.setupHand.y,
					id:$scope.setupHand.id,
				});
				// remove piece from hand
				$scope.setupHand = null;
			}
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
	$scope.$on('socket:game_session_info',function(e,data){
		$scope.pieces.length = 0;
		angular.forEach(data.pieces,function(p){
			if(p.x!==null && p.y!==null){
				console.log(p);
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