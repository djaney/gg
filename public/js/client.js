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

app.controller('GameCtrl',function($scope,GameState){
	GameState.check();

	$scope.pieces = [];


	$scope.$on('socket:game_session_info',function(e,data){
		$scope.pieces.length = 0;
		console.log();
		angular.forEach(data.pieces,function(p){
			$scope.pieces.push(p);
		});
		
	});
});