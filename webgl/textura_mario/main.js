(function () {

lazy.loadjs(["//cdnjs.cloudflare.com/ajax/libs/jquery/2.1.1/jquery.min.js", 
			 "http://threejs.org/build/three.min.js", 
			 "demo.js"],
			  function(){

			  	var applicacion = Object.create(app.demo);
			  	applicacion.inicializar(document, 640, 480);
			  	applicacion.addCubo();
			  	applicacion.addLuz();
			  	applicacion.addDirLuz();
			  	applicacion.addPlano();
			 

			 	var linear = 0;
			 	var arcox = 0;

			 	function render() {
				 	 requestAnimationFrame(render); 
				 	 applicacion.update();

				 	 linear+= 0.15;
				 	 var arcox = Math.cos(linear);

					 applicacion.objetos.cubo.rotation.y +=  0.01;
					 //applicacion.objetos.cubo.rotation.x += 0.01;

					 applicacion.objetos.cubo.position.x = arcox;
		
			 	 }

			 	 
		

				 $( document).keypress(function( event ) {
					
					//event.preventDefault();
					if(event.key === 'w')
						applicacion.camara.position.z-=1;
					
					if(event.key === 's')
						applicacion.camara.position.z+=1;

					if(event.key === 'a')
						applicacion.camara.rotation.y+=0.3;

					if(event.key === 'd')
						applicacion.camara.rotation.y-=0.3;
					

				 });

			 	  render();


			 });

}());

