---
date: "2017-12-22"
title: "Using Containers For Beginners"
---

# What is a container

A container is just a way to achieve process isolation, unlike virtual machines, they don't achieve this isolation by simulating the whole hardware, but by mechanism present in the Linux kernel to achieve this. 

In a typical Unix/Linux all processes share the same user space, but with the introduction of new features in Linux 2.6+, you can create a process that has its own particular set of isolated contexts like file tree, threads, etc. This feature in combination with other kernel technologies are the magic behind containers. 

In this article I will introduce basic Docker commands and concepts.  After you finish reading, you will be able to adopt some Docker capabilities to accelerated and simplify your day to day workflow. 

# Installing Docker

Installation of Docker is a simple task in OSX/Windows as they installation wizard, you can find the installer for your OS [here](https://www.docker.com/community-edition), In Linux is usually available in the distribution package manager. 

Installing Docker in [Fedora](https://getfedora.org/es/workstation/):  

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

the steps should be similar in others Linux distributions that use Systemd.


# Getting Started

#### Hello World

Once you finished the installation we should try a small **Hello World!** for containers:

```sh
  #sudo is only for Linux
  sudo docker run --name hello -it busybox echo "Hello World!" # Hello World!
```
Using **sudo** is only necessary if you are running Linux, in OSX and Windows at the moment of writing this article use some virtual machine behind the scene so Docker command can be run without privilege user.

#### How it works

```sh
  sudo docker run <options> <image> <command to run inside the container> 
```

```run``` it creates and run a container, one of the properties is that Docker will bind the life of the container to the running process (in this case the Linux command *echo*), which means that when process finish the container will be terminated.  

- **name** we set the name of the container, if you don't choose anything Docker will choose one at random.

- **it** this mean interactive, it will connect our terminal to the output of the container virtual TTY, allowing interact with the running process. 

- **busybox** This the base image to create the container, think of it as zip file with the files and folders necessary to run the desired application. There is a whole community base images available in [Docker Hub](https://hub.docker.com/), I use [busybox](https://hub.docker.com/r/library/busybox/tags/) because is very light just 715 KB compressed.

**echo** As we mentioned earlier is the command we try to execute that is included inside [busybox](https://hub.docker.com/r/library/busybox/tags/) image among others like vi, ps, ls, etc.

If you want check the commands available in [busybox](https://hub.docker.com/r/library/busybox/tags/) just do this:

```sh
  sudo docker run -it busybox ls /bin/
```
#### Looking your downloaded images 

When you execute the Docker command for the first time the image will be downloaded and will be cached to speed up things, you can check it by using this command:

```sh
  sudo docker images
```

#### Running in the background

To run processes in the background we use the **-d** parameter like this: 

```sh
  sudo docker run -d --name snooze busybox sleep 15
```

This process will run for 15 seconds in the background and then exit.

#### Listing background running containers

Once the container is running in the background, you can check its status with **ps**:

```sh sudo docker ps ```.

#### Killing running containers

To stop a container is simple just:

```sh
  sudo docker stop [name of your container]

#example
sudo docker stop snooze
```
This command will stop the running container, but the docker service will keep the container you created including its associated command cached in disk, in the case you want to replay the exact command again just need to do **docker start** and pass the container name.

```sh
  sudo docker start snooze
```

If you want to change the configuration and reuse the container name then you need to stop and delete the container, let say we want to change our *snooze* container, to sleep for 10 seconds instead of 15:

```sh
  # stop & clean
  sudo docker stop snooze
  sudo docker rm snooze

  # re-create
  sudo docker run -d --name snooze busybox sleep 10
```

### Mounting

The **v** parameter will allow us to mount/map a folder from the ***host*** (our computer) to a folder inside the container.

Example:

Let's create an file
```sh
  echo 'Hello World' > hello
```

Now we want to open the file using an isolated text editor available in busybox: 

```sh
  # Opening the file with our contained VIM
  sudo docker run -it busybox vi hello
```

Nothing happens, this is because the vi process we are calling is isolated. We need to mount the folder so our editor is able to find the file.

```sh
  #the :z in /app:z -> is for SELinux, non-Linux can ignore this.
  #more info see Linux Security
  sudo docker run -it -v "$(pwd)":/app:z busybox vi app/text
```

This will mount the actual folder ```$(pwd)```, to the folder ```/app``` inside the container, if the folder doesn't exist *inside* it will be created, then, it we use **vi** and pass the location of file of the mounted folder ```vi app/hello```.

Some observations:
- The **v** will overwrite any previous folder inside the container, if exist it will be replaced with the folder provided.
- The container will have access to your system resource (the shared folder) so be careful.

### Networking

Option **p** allow us to expose an isolated port and pass it through a specific **Host** port.

Let's write a simple server and lets use NodeJS as our programming language, no worry we don't need to install anything, we can use a NodeJS container for this task 😉.

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

The new stuff here is the base image **mhart/alpine-node** it will pull a Node.JS container, then will just mount using **-v** the folder as we did before and execute the isolated *node app/index.js* process, just as we did with **vi** in the mount example.

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

We are unable to connect because the container network is isolated, we need to forward the port: 

```sh
# stopping our container
sudo docker stop myserver  
sudo docker rm myserver

sudo docker run -it -v "$(pwd)":/app:z -p 8080:8080 --name myserver \
 mhart/alpine-node node app/index.js
```

Now try to open [http://locahost:8080](http://locahost:8080) in your browser and you should see a **hello world!**.

Congrats you have learned some NodeJS without installing anything in your machine, that’s one of the cool stuff about Linux containers you can try new software without installing. 

# Some quick tips

In my day to day I always need to integrate with MongoDB and Redis, but installing those are usually a painful process, I have solved this problem by creating some bash scripts in my .zshrc.  

```sh
function new_mongo {
  docker run -d --name mongodb -p  27017:27017 mongo
}

# the : here means image tag, usually if the image is done correctly 
# like in this case tag version match the Redis version
function new_redis {
  docker run -d  --name redis  -p 6379:6379 redis:3.2
}

function stop_mongo {
  docker stop mongodb
  docker rm mongodb
}

function stop_redis {
  docker stop redis
  docker rm redis
}

```

After adding this line to the bottom of your .bashrc || .zshrc , then just execute ``` source ~/.bashrc || source ~/.zshrc ```, then you should be able to do this.

```sh
new_mongo # it will spin up a new mongodb instance. 
new_redis # it will spin up a new redis instance. 

# to stop this containers 
stop_mongo
stop_redis
```

The Advantages are zero configuration or installation, if you don't need them they just terminate and remove.

# Linux security

If you execute to mount a folder by using **v** parameter in Fedora you may get this error:  

```sh
sudo docker run -it -v "$(pwd)":/app busybox ls app/text
#ls: can't open '.': Permission denied
```

This is because [SELinux](https://en.wikipedia.org/wiki/Security-Enhanced_Linux) default policy will protect any read/write in the Host, in case an attacker can get out of the container, SELinux will hold your back by enforcing security rules at Kernel level.

To mount the folder in a SELinux aware machine you need to pass the **z** parameter, this will change the SELinux context and will allow the container to perform the mounting.

```sh
# "$(pwd)" will get the actual directory, is equivalent to do pwd
docker run -it -v "$(pwd)":/app:z busybox /bin/sh
```

Other way (but not recommended) to do this is to temporarily disable this protection with:

```
su -c "setenforce 0"
```

To enable it again just do:
```
su -c "setenforce 1"
```




