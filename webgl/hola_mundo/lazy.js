
var doc   = window.document;
var lazy  = lazy || {};


(function () {

	var _script = [];
	var _cnt = 0;

	lazy.loadjs = function(script_list, callback){
		_script = script_list;
		
		lazy.callback = callback;
		lazy.file_count = script_list.length;
		lazy.make_tags(_script[_cnt]);

	}

	

	lazy.make_tags = function( tag ){
			
			console.log("cargando: " +tag);
			var _tmp = doc.createElement('script');
			var that = this; 
			
			_tmp.type = "text/javascript";
			_tmp.onload = _tmp.onreadystatechange = function() { 
			
				

				 /* IE 8 */
				 if(typeof document.attachEvent === "object"){
				 	console.log("stat: " + _tmp.readyState);
					
					if (_tmp.readyState === 'loaded' || _tmp.readyState === 'complete'){
						

						lazy.file_count--;

						if (lazy.file_count == 0) {
							that.callback();
						}else 
							that.make_tags( _script[  _script.length - lazy.file_count ] );

					 }
				}else{
				
					lazy.file_count--;
	           		if (lazy.file_count == 0) {
								that.callback();
							}else 
								that.make_tags( _script[  _script.length - lazy.file_count ] );
	            }

			};	
		
	

		_tmp.src = tag;  
		doc.getElementsByTagName('head')[0].appendChild(_tmp);
	};

}());



