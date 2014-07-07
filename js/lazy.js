var doc   	= window.document;
var lazy  	= lazy || {};
lazy.utils  = lazy.utils || {};
lazy.resources = [];
var site = {};
var routes = {};
var posts = {};

(function () {

	var _script = [];
	var _cnt = 0;
	var _template_cache = {};

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


	lazy.network = function(method, url, callback){
		var xhr = new XMLHttpRequest();
		xhr.open(method, url, true);

		xhr.onreadystatechange = function(e) {
		  if (this.readyState == 4 && this.status == 200) {
		    	callback(this.responseText);
		  }
		}

		xhr.send();
	};

	
	lazy.load_resources = function(resources, callback){

		var url = resources[0];
		resources.splice(0,1);

		lazy.network('GET', url, function(data){
			if (resources.length !== 0) {
				lazy.resources.push(data);
				lazy.load_resources(resources, callback);
			}else{
				lazy.resources.push(data);
				var res = lazy.resources;
				lazy.resources = [];
				callback.apply(null, res);
			}

		});

	}

	lazy.History = function(){

		this.urls = [];
		this.home = '#home';
		this.post_template = { url: this.home,   resource: 'template/posts.html' };

		var add_posts =  function(_posts){

				for (var i = 0; i < _posts.length; i++) {
					var post = _posts[i];
					var nav  =  { url: '#'+post.file.replace('.markdown', '') ,   resource: site.dir + post.file };
					post.link = nav.url;
					urls.push(nav);
				};

		}

		var build_page = function(){

			lazy.load_resources([
				"config.json",
				"posts.json",
				"layout/head.html",
				"layout/header.html",
				"layout/footer.html"

			], function(config, routes, headHTML, bodyHTML, footerHTLM){

				site 	= JSON.parse(config);
				posts 	= JSON.parse(routes); 

				add_posts(posts);
				document.querySelector("head").innerHTML = lazy.template.compile_execute(headHTML);	
				
				
				document.querySelector("body").innerHTML = lazy.template.compile_execute(bodyHTML);
				

				window.onpopstate = navigation;
				navigation();
								
			});


		}

		var remove_page_tag = function(str){
			return str.substring(str.indexOf('[_page]') + '[_page]'.length, str.length); 
		}

		var navigate_to = function(nav){
			var el = document.querySelector("content");
			var my_nav = nav; 
			lazy.load_resources([nav.resource], function(tmplData){
						
				var data = "";
				if(my_nav.resource.search('.markdown') !== -1){
					data = marked( remove_page_tag(tmplData) );

				}else{
					lazy.template.compile(tmplData,null);
					data = lazy.template.execute();
				}

				el.innerHTML = data; 

			});

		} 


		var get_resource = function(hash){

			for (var i = 0; i < this.urls.length; i++) {
					
				if(this.urls[i].url === window.location.hash){
				 	return this.urls[i]; 
				}

			};	
		}

		var navigation  = function(event){

				var nav = get_resource(window.location.hash);

				if(nav){
					navigate_to(nav);
				}else{
					var stateObj = { home: "begin" };
					history.pushState(stateObj, "n_info", home);
					navigate_to(get_resource(home));
				}
			}


		return {
			
			init : function(){

				urls.push(post_template);
				build_page();
			},

			add_page: function(nav){
				urls.push(nav);
			}
		}
	}();

	lazy.foreach = function(array, callback){

		for (var i = 0; i < array.length; i++) {

			callback(array[i]);
		};

	}
			

	lazy.template = function(){
		this.strbuild = "";
		this.fnParams =  [];
		var scope = ""; 
		this.tmpl = "";
		var brkt_open = '<%', brkt_close = '%>';
		

		var normalize = function(str){
			str = str.trim();
			return str.replace(/\"/g , "\\\"");
		}

		var replace_special_char = function(str){
			return str.replace('&lt;', "<").replace('&gt;', ">");
		}
			
		var formatting = function(str){
			return "\""+ normalize(str) + "\"";	
		}
		
		var config_scope = function(code){
		
			var fnParams_pattern = /function\((\D+)\)/;
			var parse = fnParams_pattern.exec(code);
				
			if(parse !== null){
				this.fnParams = parse[1].split(',');			
			}
		}

		var _value = function(value){
			if(typeof value === 'object'){
				return JSON.stringify(value);
			}else return value;	
		}
		
		var _init_param = function(js_param){
		
			//check scope var's 
			for(var fncount in this.fnParams){
			
				var lvar = this.fnParams[fncount];
				var npos = 1;
				eval(lvar + "=" + _value( js_param[ npos + parseInt(fncount) ] ) );  	
			}

		}	
	

		var _out = function(){
					
			var line = arguments[0];
			var regx = /{{(.+)}}/;
			var js_prop = regx.exec(line);			
			
			if(js_prop){
				_init_param(arguments);
				this.tmpl += line.replace(regx, eval(js_prop[1]));			
			}else{
				this.tmpl +=line;
			}
		}
		
		/* add_code add the HTML + {{ TAGS }}  */
		var add_code = function(line){
			if(this.fnParams.length > 0)
				this.strbuild += "_out("+ formatting(line) + "," +this.fnParams.toString() + "); ";
			else
				this.strbuild += "_out("+ formatting(line) + ", null);";
		}
		
		/*add_exp add the javascript expression */
		var add_exp = function(code){
			code = code.replace('<%', ''); code = code.replace('%>', '');				
			config_scope(code);
			this.strbuild += normalize(code);  
		}

		var clean = function(){
			this.strbuild="";
			this.fnParams = [];
		}
		
		var execute = function(){
			this.tmpl = "";	
			eval(this.strbuild);
			return this.tmpl;
		
		}
		
		var brkt = function(type_brkt, line){

			if(line.search(type_brkt) !== -1){
				return true; 
			}					
			
			return false;
		}

		return {
		


			compile: function(template){
					
				var braket = false;   
				var lst_lines = "";
				var collect = false; 
				strbuild ="";
				if( typeof template === 'string' ) {
    					lst_lines = template.match(/[^\r\n]+/g);
				}else 
					return "error: dont work with other data";

				for(var i = 0; i < template.length; i++){
					var line    = lst_lines[i];
			
					
					if(typeof line === "undefined") break;	
				
					var line = line.trim();

					if(line === "") continue;
					line = replace_special_char(line);
				
		
					if( brkt(brkt_open, line) && brkt(brkt_close, line) ){
				
						add_exp(line);
						continue;	
					}
				
					if( brkt(brkt_open, line) ){
						add_exp(line);
						collect = true;
 						continue;
					}

					if( brkt(brkt_close, line) ){
						add_exp(line);	
						collect = false;
						continue; 
					}
				
					if(collect){
						add_exp(line);
					}else
						add_code(line);
				
				}			


			},

			compile_execute:function(tmplt){
				this.compile(tmplt);
				return this.execute();
			},

			execute: function(){

				tmpl = "";	
				eval(strbuild);
			
				return tmpl;
			}

		};


	}();
	
}());



