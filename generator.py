
import os
import json
import pdb

list_files = []
_input_dir = ""
conf_block_ini = '[page]'
conf_block_end = '[_page]'


def check_dir(_dir):
	if not os.path.isdir(_dir):
		os.makedirs(_dir)			

def parse_page_conf(_data):
	
	ini_conf = _data.find(conf_block_ini) + len(conf_block_ini)
	end_conf = _data.find(conf_block_end)
	
	mkdow =  _data[ini_conf:end_conf]



	mkdowDict = json.loads(mkdow)
	return mkdowDict



def generate_md(md_dir): 
	
	print "generating in: " + md_dir
	
	_input_dir  = md_dir


	for _file in os.listdir(md_dir):
		
		fileRoute = md_dir + '/' + _file
		fileName, fileExtension = os.path.splitext(_file)
		if fileExtension == ".md" or fileExtension == ".markdown":
			data = ""
			with open(fileRoute) as f:
				data = f.read()
				markdown = parse_page_conf(data)
				markdown['file'] = _file 
				
				list_files.append(markdown)	
	

	with open('posts.json', 'w') as jfile:

		jfile.write(json.dumps(list_files))
		jfile.close()

	print "routes file created"




			

	
