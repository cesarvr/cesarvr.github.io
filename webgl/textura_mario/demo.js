var app = app || {};


app.demo = {
	escena: null,
	camara: null, 
	dibujador: null, 
	objetos: {},
	luces: {},
	DOM: null, // el objeto DOM para realizar añadir el CANVAS.

	inicializar:function(DOM, Width, Height){
		
		this.DOM = DOM;
		this.escena = new THREE.Scene(); 
		this.camara = new THREE.PerspectiveCamera( 75, Width / Height, 0.1, 1000 );
		this.camara.position.z = 30;


		this.dibujador = new THREE.WebGLRenderer(); 
		this.dibujador.setClearColor( 0x000000, 1 );
		this.dibujador.setSize( Width, Height ); 
		this.DOM.body.appendChild( this.dibujador.domElement );
	},


	addDirLuz:function(){

		this.luces.directionalLight = new THREE.DirectionalLight( 0xffffff, 0.5 ); 
		this.luces.directionalLight.position.set( 0, 1, 0 ); 
		this.escena.add( this.luces.directionalLight );
	}, 


	addLuz:function(){

		// create a point light
		this.luces.luz1 =	new THREE.PointLight(0xFFFFFF); // luz blanca

		// posicion
		this.luces.luz1.position.x = 10;
		this.luces.luz1.position.y = 50;
		this.luces.luz1.position.z = 25;

		// ++escena
		this.escena.add(this.luces.luz1);



	},

	addCubo:function(){

		var cubo_g 			= new THREE.BoxGeometry( 5,5,5 );
		var material_g 		= new THREE.MeshLambertMaterial({map: THREE.ImageUtils.loadTexture('coin.jpg'),
															 //color: 0xCC0000  
															});

		this.objetos.cubo 	= new THREE.Mesh( cubo_g, material_g );

		this.objetos.cubo.position.x =  1; 
		this.objetos.cubo.position.y =  1;
		this.objetos.cubo.position.z = -3;


		this.escena.add( this.objetos.cubo );

	},

	addPlano:function(){

		var geometry = new THREE.PlaneGeometry( 40, 40 ); 
		var material = new THREE.MeshLambertMaterial( {
													   map: THREE.ImageUtils.loadTexture('one_up.jpg'),
													   //color: 0x012201, 
													   side: THREE.DoubleSide
													 }); 
		this.objetos.plano = new THREE.Mesh( geometry, material ); 


		this.escena.add( this.objetos.plano );
		this.objetos.plano.position.y = -6.5;
		this.objetos.plano.rotation.x = 2;

	},

	update:function(){

		this.dibujador.render(this.escena, this.camara);
	},






};
