# Lazy Static Blog Generator
#
# 
# Github: https://github.com/cesarvr/
#

import sys
import generator as gen


print " "
print "Lazy static-site 0.1 "
print "==================== "

dir_md  = "md"
dir_out = "posts"
arg_fail = False

gen.check_dir(dir_md)

del sys.argv[0]


 


print " "
if len(sys.argv) == 0:
	print "lazy.py --help"

for arg in sys.argv:
	
	if arg == "--in":
		print  "input directory coming soon"	 
	elif arg == "--out": 
		print "output directory coming soon"
	elif arg == "--gen":
		gen.generate_md(dir_md)

	elif arg == "--help":
	 	print "usage:"
		print "--help			 show help"
		print "--gen	 		 generate navigation"
		break
	else:
		print "invalid option  	need help? --help"



