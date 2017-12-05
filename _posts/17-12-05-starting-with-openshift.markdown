---
layout: post
date: "17-12-05"
title: "Using Openshift Locally"
---

### What is Openshift

Is an enterprise ready distribution of [Kubernetes](https://kubernetes.io) and [Docker](https://www.docker.com/), basically I think about it as a orchestration system that follows your commands, to do what?, to move your software between an group of interconected computers, usually called cluster. 

To transport and deployment Openshift use an abstraction called container, wich is a technology that has two main objective, first allow us to "package" our application in an nice "image" file and second feature is that allow us to execute its content in almost complete isolation, basically from the application point of view, its the only process running in the machine and only the files in its package are the ones that are available.


### Getting Started

The orchestrator usually lives in a predefined set of computer/s called the "manager", from there its able to get your orders and then schedule this orders in order to apply it to another set of computer "workers", your comunication with the "manager" can be done by three ways, you can do RESTful webservice (You can write an software to make things automatic), you can use oc-client that is a command line tool to make those calls, or you can use a web UI, my favorite is the RESTful service, because you can create something like a robot that controls stuff for you, and in the second place is the oc-client, which is a simple command tool but very powerful to get stuff done.      

To play a little bit with Openshift we going to use a portable "minified" that we can install in our laptop, and is part of the oc-client, so first lets install our command line tool, to do this you can go to this [Openshift Origin](https://github.com/openshift/origin/releases) Github page, look for this word ``openshift-origin-client-tools-``` as that page is very crowded with ticket information, or you can download the version I'm using for this guide by executing this command. 

```sh
# Mac
curl -Lo oc.zip https://github.com/openshift/origin/releases/download/v3.7.0/openshift-origin-client-tools-v3.7.0-7ed6862-mac.zip |

# Linux-AMD64
curl -Lo oc.zip https://github.com/openshift/origin/releases/download/v3.7.0/openshift-origin-client-tools-v3.7.0-7ed6862-linux-64bit.tar.gz

# Windows 
curl -Lo oc.zip https://github.com/openshift/origin/releases/download/v3.7.0/openshift-origin-client-tools-v3.7.0-7ed6862-windows.zip
```


Next we need to install the oc-client we can achieve this by executing the following commands:
```sh
# Extract the file
mkdir -p ~/.tools/ && mv oc.zip ~/.tools/ && cd ~/.tools/ && unzip oc.zip

# Add this file to your Path
export PATH=$PATH:~/.tools/ # To make it permanent you just need to add this line to your .zshrc or .bashrc 
```

After doing this you should be able to execute the oc-client from your command line. 

```sh
oc --help 
```

### Demo 
<script type="text/javascript" src="https://asciinema.org/a/u6HacvJfu2OhOsXlqFTkX2OOd.js" id="asciicast-u6HacvJfu2OhOsXlqFTkX2OOd" async></script>
