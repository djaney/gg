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
});



// SERVICES
app.factory('GameSocket', function (socketFactory) {
	var socket = socketFactory();
	socket.forward('match_found');
	socket.forward('register');
	return socket;
});
app.factory('GameState',function(Player,$location,GameSocket){
	var gs = {
		state:'splash',
		connected:false
	};

	var obj = {
		check:function(){
			if(!this.isConnected){
				this.setState('splash');
			}else if(!Player.hasName()){
				this.setState('login');
			}else if(Player.hasName()){
				this.setState('lobby');
			}
			$location.path(this.getState());
		},
		getState:function(){return gs.state;},
		setState:function(s){gs.state = s;},
		isConnected:function(){return gs.connected;}
	};
	GameSocket.on('connect',function(){
		gs.connected = true;
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
		console.log(data);
	});

});