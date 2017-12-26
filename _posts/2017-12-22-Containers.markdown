---
layout: post
date: "2017-12-22"
title: "Using Containers For Beginners"
---

# What is a container

A container is just a way to achieve way to achieve virtualisation, think of it like a very ultra lightweight virtual machine, with very fast boot time and less resources requirement as they don't need to emulate CPU instructions.

This article I will review some simple commands and will give you some shortcuts to help you deploy apps easily using Docker.

# Installing

Installing Docker is easy you just need to visit their website and follow the instructions, is usually a simple wizard. In Linux you should look in your Distro package manager, here are some instruction to use in case your are using *Fedora*.

``` sh
 sudo dnf install docker
```
To start the process:
```sh
sudo systemctl start docker
```
To make the Docker process start and boot time:

```sh
sudo systemctl enable docker
```
# Getting Started

#### Running

Now to check that everything is installed correctly you can try this simple command:

```sh
#non Linux don't need to use sudo
sudo docker run --name hello -it busybox echo "Hello World"
```

```run``` parameter tell Docker to run a command inside of a isolated container, this container is filled with an pre-defined file structure supplied in this case by a busybox image a very light weight set of folders *1.13 MB*.  

```--name``` this will set a name to the running process container, this make the container easy to locate.

#### Interactive

**-it** means interactive, a good example of its usefulness is when you want to run interactively some proccess like a text editor like ***vi***. 
 
```sh
  sudo docker run -it busybox vi
```

#### Daemon

There are some cases when you just want the program to run and access it by other means like through the network, in this cases you don't want your terminal to be hook up to the container for that case use **-d** parameter that mean execute this command as a daemon or send it to the background.

```sh
  sudo docker run -d --name snooze busybox sleep 5
```

This process will run for 5 seconds in the background and then exit


#### Stopping 

To stop a container is simple just: 

```sh 
sudo docker stop  [name of your container]

#example
sudo docker stop snooze
```
After you stop a container it will shutdown from memory, but it will the docker service will keep it cached in disk and will save the command in case you want to respawn, so if you want to reuse it, you just need to use **docker start** like this: 

```sh 
sudo docker start snooze
``` 

This is very handy if you want to just start the same configuration, if you want to change the configuration and reuse the name then you need to stop and delete the container, let say we want to bump the sleep process to 10 seconds, the we need to do this: 

```sh 
# stop & clean
sudo docker stop snooze
sudo docker rm snooze

# re-create
sudo docker run -d --name snooze busybox sleep 10
``` 

# Advanced Features 

### Mounting

Parameter:
```-v [Host Folder]:[Container Folder]```

The **v** parameter will allow us to mount/map a folder from the ***host*** inside a folder inside the container. 

Let execute try and execute vim and get an open a file in our system:

```sh
# Let create a file
echo 'hello' > text

# Opening the file with our contained VIM
sudo docker run -it busybox vi text
```

Nothing happens, this is because the VI process we are calling is isolated, so we are unable to comunicate our space with the BusyBox isolated space, so lets see what we can do about it.


```sh
docker run -it -v "$(pwd)":/app busybox vi app/text
```
This will mount the actual folder ```$(pwd)```, inside the container folder ```/app``` if the folder doesn't exist it will be created, then next, it we use **Vi** and pass the file of the mounted folder ```vi app/text```.

Some observations:
- The **v** will overwrite the container folder, if exist it will be replaced with the folder provided.
- The container will have access to your system resource so be careful.

### Networking

Parameter:
```-p [Container Port]:[Host Port]```

This option allow us to expose an isolated port and pass it through a specific **Host** port.

Let's write a simple server and lets use NodeJS as is high level Lang, no worry you won't need to install anything, we have containers 😉.

Save this in a file named **index.js**:

```js
  require('http')
    .createServer((req, res) => { res.end('Hello World!') }).listen(8080)
```

This server waits for connection in port **8080**, and when somebody connects it will send a **Hello World!** string.

Let create our container:

```sh
 sudo docker run -it -v "$(pwd)":/app:z --name myserver mhart/alpine-node node app/index.js
```

The new stuff here is the **mhart/alpine-node** it will pull a Node.JS ready container, then will just mount the folder as we did before and execute the isolated *node app/index.js* process, just as we did with **Vi** in the mount example.

Let see if our server is working:

```sh
sudo docker exec -it myserver wget -qO- localhost:8080
# Hello World%
```

This command test that our server is working from within the container and we should get back **Hello World%**, Now let's try to connect from our **Host**, open a new terminal, and write:

```sh
curl http://localhost:8080
#curl: (7) Failed to connect to localhost port 8080: Connection refused
```

Ok, now let forward the port to the **Host**:

```sh
# stoping our container
sudo docker stop myserver  
sudo docker rm myserver

sudo docker run -it -v "$(pwd)":/app:z -p 8080:8080 --name myserver \
 mhart/alpine-node node app/index.js
```

Now try to open [http://locahost:8080](http://locahost:8080) in your browser and you should see a **hello world!**.


# Security

If you execute this command in Fedora you may get this error:  

```sh
#ls: can't open '.': Permission denied
```

This is because [SELinux](https://en.wikipedia.org/wiki/Security-Enhanced_Linux) default policy will protect any read/write in the Host, in case an attacker can get out of the container, SELinux will hold your back by enforcing security rules at Kernel level.

To mount the folder in a SELinux aware machine you need to pass the **z** parameter, this will change the SELinux context and will allow the container to perform the mounting.

```sh
# "$(pwd)" will get the actual directory, is equivalent to do pwd
docker run -it -v "$(pwd)":/app:z busybox /bin/sh
```

Other way to do this is to temporarily disable this protection with:

```
su -c "setenforce 0"
```

To enable it again just do:
```
su -c "setenforce 1"
```
