---
date: "2018-05-22"
title: "How Linux Containers Works"
layout: post
---

# Linux Containers 

Linux containers are very popular this days, they offer a way to isolate, deploy and manage application, the first time I hear the term was difficult for me to understand what's really behind the scene, how it works? I started to hear a bunch of terms like CGroups and Linux Namespaces, none of this terms ringed a bell for me. It wasn't until I found this [talk](https://www.youtube.com/watch?v=_TsSmSu57Zo) of [Liz Rice](https://twitter.com/lizrice) that all the piece fell together, I was so happy to get an idea of what technology was involved that I decide to investigate my self and replicate the examples of the talk using Linux lingua franca, C. The advantages of doing it this way is that I learned a lot about Linux inner workings. As a part of this adventure I decided to document this and write this article for people want to start hacking with Linux containers. 



## Getting Started

In this article we are going to create an application to isolate other applications. To follow this article you don't need to being an expert in C or C++ you can understand the concepts as we are going to talk about the specific Kernel feature that enable containerization, if you want to play with the code then you just need Linux and c++11 which is available in any modern Linux distribution, the code is simple C and we are going to use C++ when we try to simplify things, without any further introduction lets start writing our container system, let's start by writing the obligatory *hello world*: 


```c++
#include <iostream>

int main() {
  printf("Hello, world! \n");

  return EXIT_SUCCESS; // this is a integer constant equals 0, in Unix/Linux is success. 
}
```

To compile the code, we just call ```g++ <source-file> -o <name-of-the-binary>```:

```sh
g++ container.cc -o container  
```

This will generate our binary called ```container```, that we should execute by doing:

```sh
./container   
# Hello World!
```

## Creating Processes

The first functionality we need to implement in our program is a way to execute other programs, but before executing other programs we need to create a child process. this child process then would become the jail of the program we want to execute.  

Right now our process looks like this:  

``` 
  +--------+  
  | parent | 
  |--------| 
  | main() |  
  +--------+ 
```


To create a child process we need to clone this process and execute a function inside the new copy. Let's start by writing a function called ```jail```. 

```c++ 
int jail(void *args) {
  printf("Hello !! ( child ) \n");
  return EXIT_SUCCESS;  
}
```

Now our process will look something like this: 

``` 
  +--------+  
  | parent | 
  |--------| 
  | main() | 
  |--------| 
  | jail() |  
  +--------+ 
```

Next step is to invoke the system call to create the child process based in our process, for this we are going to use [clone](http://man7.org/linux/man-pages/man2/clone.2.html). 

```c++ 
clone(jail, stack_memory(), SIGCHLD, 0)
``` 

First parameter is our entry point function, *second* parameter is a function to allocate some stack memory for our process, *third* (SIGCHLD) we are telling the Linux that we want the parent to be notified when this process finish and the the purpose of the *fourth* and last one, necessary if we want to pass arguments to the ```jail``` in this case we pass just ```0```. 


``` 
  +--------+             +--------+
  | parent |             |  copy  |
  |--------|             |--------|
  | main() |  clone -->  | jail() |
  |--------|             +--------+                     
  | jail() |              
  +--------+                
```

This looks good but we need a final touch, if you look at the [clone](http://man7.org/linux/man-pages/man2/clone.2.html) call above we passed a flag telling our child process to send a signal when it finish, we capture this signal with the system call [wait](http://man7.org/linux/man-pages/man2/wait.2.html).


```c++ 
 wait(nullptr); //wait for every child.
``` 

We got all the pieces to create new processes, after the updates the code will look like this:

```c++
#include <iostream>
#include <sched.h>
#include <sys/types.h>
#include <unistd.h>
#include <sys/wait.h>

int jail(void *args) {
  printf("Hello !! ( child ) \n");
  return EXIT_SUCCESS;
}

int main(int argc, char** argv) {
  printf("Hello, World! ( parent ) \n");

  clone(jail, stack_memory(), SIGCHLD, 0);
  wait(nullptr);
  return EXIT_SUCCESS;
}
```

Compile and execute. 

```sh
./container
#Hello, World! ( parent )
#Hello !! ( child )
```

Here our program send the first greeting (parent), then we clone the process and run the ```jail``` function inside and it end up printing a greeting as well. 


## Running Programs   

It's time to load a real program. Let's chose shell, so we can test what's happening inside our container. To load a program we are going to use [execvp](https://linux.die.net/man/3/execvp), this function replace the child process image with the executable of your choice.

```c++
execvp("<path-to-executable>", {array-of-parameters-including-executable});
```
The syntax to run the program will look something like this: 

```c++
char *_args[] = {"/bin/sh", (char *)0 };
execvp("/bin/sh", _args);
```

To keep it simpler and reusable we can wrap it into a function. 

```c++
//we can call it like this: run("/bin/sh"); 
int run(const char *name) {
  char *_args[] = {(char *)name, (char *)0 };
  execvp(name, _args);
}
```

This version is enough for our purposes, but it doesn't support multiple parameters, so just for fun I write this alternative version that accepts multiple parameters using some C++ templates black magic. 

```c++ 
//we can call it like this: run("/bin/sh","-c", "echo hello!");  
template <typename... P>
int run(P... params) {
  //basically generating the arguments array at compile time. 
  char *args[] = {(char *)params..., (char *)0};
  return execvp(args[0], args);
}
```

Now that we have defined our function, we should update the entry point function for our child process. 

```c++
int jail(void *args) {
  run("/bin/sh"); // load the shell process.
  
  return EXIT_SUCCESS;
}
```


We compile/run this: 

```
process created with pid: 12406
sh-4.4$
```

## Environment Variables

After playing around with ```sh``` we are noticing that is far from being isolate. To understand how changing the execution context change how the underlaying process behave, we are going to run a simple example by clearing the environment variables for the ```sh``` process.

This is easy we just need to clear the variables before we passing the control to ```/bin/sh```. We can delete all the environment variables for the child context using the function [clearenv](https://linux.die.net/man/3/clearenv). 

```c++
int jail(void *args) {
  clearenv();   // remove all environment variables for this process.

  run("/bin/sh");
  return EXIT_SUCCESS;
}
```

We run the code again and inside the shell we run the command ```env```:

```sh
  # env
  SHLVL=1
  PWD=/
```

Not bad, we solved the information leak from the guest and we are able to observe that performing changes in the context of the child process stay local to the child process. 


## Linux Namespaces

### Universal Time Sharing

Imagine an scenario where we have to deal with a program that need to change the hostname of the machine to work, if you execute this particular program in your machine it can mess with other programs, like some network file sharing services. Imagine that somebody give us the task to look for the most efficient way to do this, first option coming to mind is using a VM, but we need to provision the VM (Memory, Storage, CPU, etc..), install the OS. It can take easily a couple of hour. Other possible way to solve this problem is to somehow the Kernel allow us to virtualise some features, this is when [Linux Namespaces](https://en.wikipedia.org/wiki/Linux_namespaces) come handy. 


Here is a quick illustration. 

``` 
                 Linux Kernel
 +-----------------------------------------------+
 
    Global Namespace's { UTS, PID, MOUNTS ... }
 +-----------------------------------------------+
 
         parent                   child process        
  +-------------------+            +---------+       
  |                   |            |         |
  | childEntryPoint() | clone -->  | /bin/sh |   
  |                   |            |         |
  +-------------------+            +---------+
```

All the processes in the system share the same UTS Namespace. To solve our problem we need to ask the Linux Kernel to clone the namespace for us.  


This is what we want: 

``` 
                  Linux Kernel
 +-----------------------------------------------------+
 
  Global Namespace { UTS, ... }              UTS
 +-----------------------------+      +----------------+
                                            
         parent                         child process        
  +-------------------+                  +---------+       
  |                   |                  |         |
  |      jail()       |    clone -->     | /bin/sh |   
  |                   |                  |         |
  +-------------------+                  +---------+
```


To get this new context for our process is, as simple, as to pass the ```CLONE_NEWUTS``` flag to our function [clone](http://man7.org/linux/man-pages/man2/clone.2.html).

```c++
int jail(void *args) {
  clearenv();   // remove all environment variables for this process.
  run("/bin/sh");
  return EXIT_SUCCESS;
}

int main(int argc, char** argv) {
  printf("Hello, World! ( parent ) \n");

  clone(jail, stack_memory(), CLONE_NEWUTS | SIGCHLD, 0);
  #                           ^^ new flag
  wait(nullptr);
  return EXIT_SUCCESS;
}
```

Now lets prove our hypothesis, we recompile and execute our program:

```sh
./container                                                     
error: clone(): Operation not permitted
```

This happens because what we try to do (cloning the UTS namespace) requires [CAP_SYS_ADMIN](https://lwn.net/Articles/486306/), or in other words; we need elevated privileges.

```
sudo ./container                                      
[sudo] password for cesar:
process created with pid: 12906
sh-4.4#
```

It works!, now let's see what happen when we modify the hostname:

![alt text](https://raw.githubusercontent.com/cesarvr/cesarvr.github.io/master/static/containers/uts.gif "Cloning UTS Namespace")


### Isolating Processes

Let's play with another Linux Namespace, this time we are going to isolate our shell process from the rest of processes, from it's point of view it will be running solo in the machine, the flag we need for this is the ```CLONE_NEWPID``` flag, also we are going to log the parent process id, by using the function [getpid](http://man7.org/linux/man-pages/man2/getpid.2.html):

```c++
int jail(void *args) {
  clearenv();
  printf("child process: %d", getpid());
  run2("/bin/sh");
  return EXIT_SUCCESS;
}

int main(int argc, char** argv) {
  printf("Hello, World! ( parent ) \n");
  printf("parent %d", getpid());

  clone(child, stack_memory(), CLONE_NEWPID | CLONE_NEWUTS | SIGCHLD, 0);
  #                            ^^ new flag
  wait(nullptr);
  return EXIT_SUCCESS;
}
```

 ```

Compile and run:

```sh
sudo ./container                                  
parent pid: 3306
child pid: 1
/ #
```

As you can observe the child *PID* is one which mean from it's point of view is running alone, now let's proof our process ability to check our ability list other processes in the system, by executing  ```ps```. 

![alt text](https://github.com/cesarvr/cesarvr.github.io/blob/master/static/containers/pid-ns.gif?raw=true
 "PID NS")

It seems that we fail, but in reality ```ps``` is gathering this information from the ```/proc``` file system, which has process information, which mean that to achieve complete isolation of processes we need to hide this folder from our process. 


## Isolating Filesystem 

### Changing The Root

Now we need to get serious in the isolation business, let's isolate the files and folder the process we are executing can access. All processes in Linux share the same file table, but something that Linux has inherit from Unix is the ability to change the root folder of a specific process, we can do this by using [chroot](http://man7.org/linux/man-pages/man2/chroot.2.html).


Illustration of what we try to achieve. 

```
 Processes 
   +---+
   |   | -- +     FileSystem (real root)  
   +---+    | 
            +----> / 
   +---+    |
   |   | -- +
   +---+

  Isolated        FileSystem (arbitrary folder)
   +---+  
   |   | ------>   /
   +---+
```

Let's write the necessary code to change the root. 


```sh 
void setup_root(const char* folder){
  chroot(folder);
  chdir("/");
}
```   

For this we are going to hide the complexity behind a function called ```setupFileSystem``` then we change the root of the folder using [chroot](http://man7.org/linux/man-pages/man2/chroot.2.html) and last but not least tell the process to jump to the new root folder.


#### Preparing The Root Folder

We can change the root to an empty folder but if we do that we are going to loose the tools we are using so far to inspect the quality of our container (ls, cd, etc..), to avoid this we need to get some Linux base folder that include all this tools. I'll choose [Alpine Linux](https://github.com/yobasystems/alpine) because is very minimal, about 2MB compressed.

Just grab the base [install](alpine-minirootfs-3.7.0_rc1-x86_64.tar.gz). 

```
mkdir root && cd root
curl -Ol http://nl.alpinelinux.org/alpine/v3.7/releases/
```

Uncompress into a folder called ```root``` at the same level of our binary.

```
x86_64/alpine-minirootfs-3.7.0_rc1-x86_64.tar.gz
tar -xvf alpine-minirootfs-3.7.0_rc1-x86_64.tar.gz
```

#### Configuration 

Also we want to setup some environment variables to help shell to find the binaries and to help other processes to know what type of screen we have, we are going to replace ```clearenv``` with a function that take care of those tasks. 

```
void setup_variables() {
  clearenv();
  setenv("TERM", "xterm-256color", 0);
  setenv("PATH", "/bin/:/sbin/:usr/bin:/usr/sbin", 0);
}
```



#### Coding

This is the how the code looks, after we implemented the apply the refactoring:

```c++
void setup_variables() {
  clearenv();
  setenv("TERM", "xterm-256color", 0);
  setenv("PATH", "/bin/:/sbin/:usr/bin:/usr/sbin", 0);
}

void setup_root(const char* folder){
  chroot(folder);
  chdir("/");
}

int jail(void *args) {
  printf("child process: %d", getpid());

  setup_variables();
  setup_root("./root");

  run("/bin/sh");
  return EXIT_SUCCESS;
}

int main(int argc, char** argv) {
  printf("parent %d", getpid());

  clone(child, stack_memory(), CLONE_NEWPID | CLONE_NEWUTS | SIGCHLD, 0);
  wait(nullptr);
  return EXIT_SUCCESS;
}
```

















