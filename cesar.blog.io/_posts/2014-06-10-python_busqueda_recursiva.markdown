---
layout: post
title:  "Busqueda recursiva de ficheros usando Python"
date:   2014-06-10 21:55:25
categories: python busqueda
---

Este snippet viene bien cuando se quiere buscar ficheros deforma recursiva
en el Filesystem, se puede mejorar para que busque un patron de nombre de fichero especifico etc. 


{% highlight python %}

def buscarTodos(directorio, nombre_fichero, lst):
     
     for fichero in os.listdir(directorio):
          tmp_dir = directorio + '/' + fichero

     if fichero.endswith(nombre_fichero)>0:
          lst.append(tmp_dir)

     if os.path.isdir(tmp_dir): 
          buscarTodos(tmp_dir, nombre_fichero, lst)  # busqueda recursiva

{% endhighlight %}

modo de uso:
{% highlight python %}

listado_ocurrencias = []
buscarTodos('/home/usuario/mi_folder', '.tar.gz',listado_ocurrencias)

if len(listado_ocurrencias) > 0:
     print 'encontrado->' ,listado_ocurrencias
else:
     print 'no encontrado'

{% endhighlight %}

Check out the [Jekyll docs][jekyll] for more info on how to get the most out of Jekyll. File all bugs/feature requests at [Jekyll's GitHub repo][jekyll-gh].

[jekyll-gh]: https://github.com/jekyll/jekyll
[jekyll]:    http://jekyllrb.com
