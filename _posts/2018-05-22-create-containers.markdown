---
date: "2018-05-22"
title: "How Linux Containers Works"
layout: post
---


<!--ts-->
   * [What is this article about](#getting_started)
   * [Why you might care about it](#care)
   * [Hello World!](#hello)
   * [Creating A Process](#process)
   * [Running Programs](#programs)
   * [Environment Variables](#env)
   * [Linux Namespaces](#linuxns)
     - [UTS](#uts)
     - [Process Identification Namespace](#pidns)
   * [Isolating A File System](#fsns)
     - [Changing Root](#chroot)
       - [Preparing The Root Folder](#prepare)
       - [Configuration](#chroot_config)
     - [Mounting File System](#mount)
       - [Unmount](#cleanup)
   * [Control Group](#cgroup)
   * [Wrapping Up](#conclusion)
<!--te-->


<a name="getting_started"/>

### What is this article about

Is basically about how to create your own container program using C. In this article we are going to review the technology and principles that make the isolation of processes a reality in Linux, the steps are base in this excellent [talk](https://www.youtube.com/watch?v=_TsSmSu57Zo) done by [Liz Rice](https://twitter.com/lizrice).

[But why C](https://pragprog.com/magazines/2011-03/punk-rock-languages)? because I love the simplicity of that language (I'm also a romantic) and also is the lingua franca of Linux which means, that it helps to get a better understanding about how things work at system level. 

<a name="care"/>

### Why you might care about it

 Well I really love to see how things works behind the scene, so I just create this article for people that share the same curiosity. Also knowing how it works helps a lot when you need push the limit of a particular technology, imagine if you have the nice challenge to pass a GPU to a container.


<a name="hello"/>

### Hello World!

Enough of introduction let's write our container or a program that isolate other programs. We are going to start by writing the obligatory *Hello World*. 

```c
#include <iostream>
int main() {
  printf("Hello, World! \n");
  
  return EXIT_SUCCESS; 
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

<a name="process"/>

## Creating Processes

The first functionality we need to implement in our program is a way to execute other programs, but when you execute a program in Linux the program take control of the process, which mean you are no longer in control, to solve this we are going create a new process and execute the program there. 

Right now our process looks like this:  

``` 
  +--------+  
  | parent | 
  |--------| 
  | main() |  
  +--------+ 
```


To create a new process we need to clone the actual process and provide a function to be executed in it. Let's start by writing the function let's called ```jail```. 

```c
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

Next step is to invoke the system call to create the child process, for this we are going to use [clone](http://man7.org/linux/man-pages/man2/clone.2.html) system call. 

```c
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

  return EXIT_SUCCESS;
}
``` 

First parameter is our entry point function, *second* parameter requires a pointer to allocated memory, *third* (SIGCHLD) this flag tell the process to emit a signal when finish and the *fourth* and last one is only necessary if we want to pass arguments to the ```jail``` function, in this case we pass just ```0```. 


``` 
  +--------+             +--------+
  | parent |             |  copy  |
  |--------|             |--------|
  | main() |  clone -->  | jail() |
  |--------|             +--------+                     
  | jail() |              
  +--------+                
```

After creating the new process we need to tell the parent process to wait until the child finish execution, otherwise the child can become a [zombie](https://en.wikipedia.org/wiki/Zombie_process). The [wait](http://man7.org/linux/man-pages/man2/wait.2.html) system call does just that.

```c
 wait(nullptr); //wait for every child.
``` 

We update the code will look like this:

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


<a name="programs"/>

## Running Programs   

It's time to load a real program. Let's chose [shell](https://en.wikipedia.org/wiki/Unix_shell), so we can test what's happening inside our container. To load a program we are going to use [execvp](https://linux.die.net/man/3/execvp), this function will replace the current process in this case the child with a instance of the program.

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


<a name="env"/>

## Environment Variables

After playing around with ```sh``` we are noticing that is far from being isolate. To understand how changing the execution context change how the underlying process behave, we are going to run a simple example by clearing the environment variables for the ```sh``` process.

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


<a name="linuxns"/>

## Linux Namespaces

<a name="uts"/>

### Universal Time Sharing

Imagine an scenario where we have to deal with a program that need to change the host name of the machine to work, if you execute this program in your machine it can mess with other programs like for example your network file sharing services. Imagine that somebody give us the task to look for the most efficient way to do this, first option coming to mind is using a VM, but we need to provision the VM (Memory, Storage, CPU, etc..), install the OS, etc. It can take a couple of hour. It won't be nice if your Operative System can deal with that isolation for you? Here is when [Linux Namespaces](https://en.wikipedia.org/wiki/Linux_namespaces) come into the picture. 


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

All the processes in the system share the same UTS Namespace. 


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

To get a copy of the global UTS for our child process we simply pass the ```CLONE_NEWUTS``` flag to [clone](http://man7.org/linux/man-pages/man2/clone.2.html), the updated code will look like this:

```c
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

This happens because, what we try to do (cloning the UTS namespace) requires [CAP_SYS_ADMIN](https://lwn.net/Articles/486306/), or in other words; we need elevated privileges.

```
sudo ./container                                      
[sudo] password for cesar:
process created with pid: 12906
sh-4.4#
```

It works!, now let's see what happen when we modify the host name:

![alt text](https://raw.githubusercontent.com/cesarvr/cesarvr.github.io/master/static/containers/uts.gif "Cloning UTS Namespace")

<a name="pidns"/>

### Process Identification 

This time we are going to isolate our shell process from the rest of processes, from it's point of view it will be running solo in the machine, this one like the example above require to pass just a flag ```CLONE_NEWPID``` in this case. To illustrate the effect of this flag we are going to display the process identifier using [getpid](http://man7.org/linux/man-pages/man2/getpid.2.html):

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

Compile and run:

```sh
sudo ./container                                  
parent pid: 3306
child pid: 1
/ #
```

As you can observe the child *PID* is 1, from child process perspective is the only process in the machine, now let's see if we can still see other processes in the system by executing ```ps```. 

![alt text](https://github.com/cesarvr/cesarvr.github.io/blob/master/static/containers/pid-ns.gif?raw=true
 "PID NS")

We are still capable to list other processes in the system, but this is because our process and it's child ```ps``` still have access to the  ```/proc``` folder, in the next section we are going to learn how to isolate the folders our process can access.


<a name="fsns"/>

## Isolating A File System 

<a name="chroot"/>

### Changing The Root

This one is easy we want just to change the root folder of our process using [chroot](https://linux.die.net/man/1/chroot). We basically can select a folder and isolate our process inside that folder in such a way that (theoretically) it cannot navigate outside. I draw this illustration to show what we try to achieve. 

```
   folders our process can access 
    ----------------------------
                 a 
                 |
              b --- c  
              |
             ----
             |  |
             d  e  
```
The root here is represented by ```a```, you can navigate all the way from ```a``` to ```e```. If you execute ```chroot("b")``` we'll end up with this tree.    

```
   folders our process can access 
    ----------------------------
                b   
                |
               ----
               |  |
               d  e  
```
Now we only can traverse from ```b``` to ```e``` or ```d``` that's the point behind changing the root, we can save sensitive files in ```a``` because the process cannot scape from ```b```. 

Let's write the necessary code to change the root. 


```c++ 
void setup_root(const char* folder){
  chroot(folder);
  chdir("/");
}
```   

For this we are going to hide the complexity behind a function called ```setupFileSystem``` then we change the root of the folder using [chroot](http://man7.org/linux/man-pages/man2/chroot.2.html) and last but not least tell the process to jump to the new root folder.

<a name="prepare" />

#### Preparing The Root Folder

We can change the root to an empty folder but if we do that we are going to loose the tools we are using so far to inspect the quality of our container (ls, cd, etc..), to avoid this we need to get some Linux base folder that include all this tools. I'll choose [Alpine Linux](https://github.com/yobasystems/alpine) because is very lightweight.

Just grab the base [install](http://nl.alpinelinux.org/alpine/v3.7/releases/x86_64/alpine-minirootfs-3.7.0-x86_64.tar.gz). 

```
mkdir root && cd root
curl -Ol http://nl.alpinelinux.org/alpine/v3.7/releases/x86_64/alpine-minirootfs-3.7.0-x86_64.tar.gz
```

Uncompress into a folder called ```root``` at the same level of our binary.

```
tar -xvf alpine-minirootfs-3.7.0_rc1-x86_64.tar.gz
```

![alt text](https://github.com/cesarvr/cesarvr.github.io/blob/master/static/containers/setup_folder.gif?raw=true
 "setup folder")

<a name="chroot_config" />

#### Configuration 

Also we want to setup some environment variables to help shell to find the binaries and to help other processes to know what type of screen we have, we are going to replace ```clearenv``` with a function that take care of those tasks. 

```c++
void setup_variables() {
  clearenv();
  setenv("TERM", "xterm-256color", 0);
  setenv("PATH", "/bin/:/sbin/:usr/bin:/usr/sbin", 0);
}
```


#### Coding

This is the how the code looks, after we implemented the functions:

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

Now let's see the code in action:

![alt text](https://github.com/cesarvr/cesarvr.github.io/blob/master/static/containers/setup_root.gif?raw=true
 "chroot")


Now we cannot longer see the processes with ```ps```, this is because we replaced the general ```/proc``` folder with the one that came with the alpine which by default is a empty directory, in the next section we are going to mount the **proc** file system. 

<a name="mount" />

#### Mounting File Systems

Mounting a file system is like exposing the content of a device like a disk, network or other entities by using the folder and files metaphors. In simple terms that what is. To mount something in Linux we need a resource that understand this metaphor like procfs](https://en.wikipedia.org/wiki/Procfs) and a folder we are going to choose the folder ```/proc``` that comes with alpine distribution. 

To mount a file system in Linux we are use [mount](http://man7.org/linux/man-pages/man2/mount.2.html) system call, this call require the following parameters to work:

```c
mount("proc", "/proc", "proc", 0, 0);
``` 

The first parameter is the resource, the second is the folder destination and the third parameter is the type of file system in this case [procfs](https://en.wikipedia.org/wiki/Procfs). 

Implementing the code is simple we just add the same line as above after we configure the **chroot**: 

```c
int jail(void *args) {
  printf("child process: %d", getpid());

  setup_variables();
  setup_root("./root");
  
  mount("proc", "/proc", "proc", 0, 0);
  
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

<a name="cleanup" />

### Unmount 

Every time we [mount](http://man7.org/linux/man-pages/man2/mount.2.html) a file system is always a good practice that we release what we don't use. To release the binding we use [unmount](http://man7.org/linux/man-pages/man2/umount.2.html).  

```c
umount("<mounted-folder>")
```

We are going to [unmount](http://man7.org/linux/man-pages/man2/umount.2.html) just before our contained process exit: 

```c
  mount("proc", "/proc", "proc", 0, 0);
  
  run("/bin/sh");

  umount("/proc"); 
  return EXIT_SUCCESS;
```

There is a small challenge here, that wasn't obvious for me the first time. Every time we call ```run``` our process get replaced by a new process image and we won't be able to call ```umount```, basically the instructions are going to stop in ```run``` and from there ```sh``` is in control and we can forget about the last two instructions. 

The solution to this is to decouple this program loading from the rest of the child function. As we learn above, to run a function in a separated process in Linux we use [clone](http://man7.org/linux/man-pages/man2/clone.2.html). Let's make use of this knowledge and re-factor our code.   

Let's start by grouping our process creation instruction into a reusable function:  

```c 
int main(int argc, char** argv) {
  printf("parent %d", getpid());

  clone(child, stack_memory(), CLONE_NEWPID | CLONE_NEWUTS | SIGCHLD, 0);
  wait(nullptr);

  return EXIT_SUCCESS;
}
```

We rewrite this two instructions into a more nicer interface: 

```c 
template <typename Function>
void clone_process(Function&& function, int flags){
 auto pid = clone(function, stack_memory(), flags, 0);

 wait(nullptr);
}
```

Here, I'm using a C++ template to create a new "generic type" called **Function** which will morph into a C function, then we pass function to [clone](http://man7.org/linux/man-pages/man2/clone.2.html), also we pass the flags as an integer. 


To use our function we just re-write our *main* function: 

```c
int main(int argc, char** argv) {

  printf("parent pid: %d\n", getpid());
  clone_process(jail, CLONE_NEWPID | CLONE_NEWUTS | SIGCHLD );

  return EXIT_SUCCESS;
}
```

Nice, now let's use this function to run our binary in a child-process: 


```c++
int jail(void *args) {

  printf("child pid: %d\n", getpid());
  setup_variables();

  setup_root("./root");
  mount("proc", "/proc", "proc", 0, 0);

  auto runThis = [](void *args) ->int { run("/bin/sh"); };

  clone_process(runThis, SIGCHLD);

  umount("/proc");
  return EXIT_SUCCESS;
}
```


Let's explain the changes: 

```c
auto runThis = [](void *args) ->int { run("/bin/sh"); };

clone_process(runThis, SIGCHLD);
```

Here we just a C++ feature called ([Lambda](https://en.cppreference.com/w/cpp/language/lambda)) which basically is like a in-line function, the we plug it to our generic typed ```clone_process``` and the compiler do the rest.

Our last version look like this: 

```c++
int jail(void *args) {

  printf("child pid: %d\n", getpid());
  setHostName("my-container");
  setup_variables();

  setup_root("./root");

  mount("proc", "/proc", "proc", 0, 0);

  auto runThis = [](void *args) ->int { run("/bin/sh"); };

  clone_process(runThis, SIGCHLD);

  umount("/proc");
  return EXIT_SUCCESS;
}

int main(int argc, char** argv) {

  printf("parent pid: %d\n", getpid());
  clone_process(jail, CLONE_NEWPID | CLONE_NEWUTS | SIGCHLD );

  return EXIT_SUCCESS;
} 
```

![mounting procfs](https://github.com/cesarvr/cesarvr.github.io/blob/master/static/containers/mount-ns.gif?raw=true)

Now our program is capable of successfully mount procfs](https://en.wikipedia.org/wiki/Procfs), release the file system after we exit and the best thing of all it can show the processes inside the container.

![boom!](https://media.giphy.com/media/xT0GqGUyFPeYYmYD5K/giphy.gif) 

#### Explanation

When we create the child process (```jail```) we used the flag ```CLONE_NEWPID```, this flag give to our cloned process something like it's own process tree.

This is how our machine looks when running Linux. 

```
   Init-1
   ------ 
     |  child's 
     |  
 ----------------------
 |          |         |
systemd-2  bash-3   our-container-4  
                      |
                    jail - 5
                      |
                    shell - 6 

```
 
 When we apply the flag ```CLONE_NEWPID``` this happens, the global system look like this. 

```
   Init-1
   ------ 
     |  child's 
     |  
 ----------------------                    
 |          |         |
systemd-2  bash-3   our-container-4
                      |
                     jail - 5
                      |
                    shell - 6 
```

But our process see itself like this: 

```
   jail - 1
   ------ 
     |  child's 
     |  
   shell-2  
```

Try to call ```ps``` inside this version and you will get this. 

```sh
PID   USER     TIME   COMMAND
    1 root       0:00 ./container
    2 root       0:00 /bin/sh
```

Moral of the story is when you clone the PID tree, your process is not able not longer able to track other processes but you can still track the everything from outside the container. For example if you run ```ps aux | grep sh ``` you'll be able to see your container. Try this with Docker or LXC and see what happens. 

Here is a small screen recording: 

![track](https://github.com/cesarvr/cesarvr.github.io/blob/master/static/containers/pid-track.gif?raw=true)

Check how ```sleep``` has different PID inside the container and outside. 


<a name="cgroup"/>

## Control Group 

Imagine now that we are given the task to contain a program from creating more processes, taking all the network bandwidth, consuming all the CPU time available or how do we guarantee that our contained applications live in harmony with other processes? To solve this type of problem Linux provide a feature called ([Linux Control Group](https://www.kernel.org/doc/Documentation/cgroup-v2.txt)) or cgroup for short, which is a mechanism to distribute kernel resources between processes. 

#### Limiting Process Creation 

Let's write a new functionality in our container, this functionality will limit the amount of processes that our contained process (```sh```) can create but before we start I'll explain how we can interact with ([Linux Control Group](https://www.kernel.org/doc/Documentation/cgroup-v2.txt)). 

You might heard the phrase in Linux ["Everything is a file"](https://en.wikipedia.org/wiki/Everything_is_a_file), cgroup like procfs is another example of that philosophy. This mean we can interface with it by using any files I/O API or application. For this example I'll use this simple Linux I/O API [open](http://man7.org/linux/man-pages/man3/fopen.3.html), [write](https://linux.die.net/man/2/write), [read](https://linux.die.net/man/3/read) and [close](http://man7.org/linux/man-pages/man3/fclose.3.html). Now the next step is to understand what files we need to change.     

The control group file system directory is usually mounted here:

```
 /sys/fs/cgroup  
```

We want to limit the creation of processes, so we need to go to ```pids``` folder. 

```
 /sys/fs/cgroup/pids/  
```

Once we're here, we can create a top folder that will encapsulate all the rules, it can have any acceptable folder name I'll choose the name *container*. 

``` 
/sys/fs/cgroup/pids/container/ 
``` 

Let's write the code to create the folder: 

```c
#include <sys/stat.h>
#include <sys/types.h>
#define CGROUP_FOLDER "/sys/fs/cgroup/pids/container/"

void limitProcessCreation() {
  mkdir( PID_CGROUP_FOLDER, S_IRUSR | S_IWUSR);  // Read & Write

}

```

When we create this folder, **cgroup** automatically generate some files inside, those files describe the rules and states of the processes in that group, at the moment now we don't have any process attached.  

```sh
cgroup.clone_children  cgroup.procs  notify_on_release  pids.current  pids.events  pids.max  tasks
```

To attach a process here we need to (write)[https://linux.die.net/man/2/write] the process identifier (PID) of our process to the file ```cgroup.procs```.

```c 
#include <string.h>
#include <fcntl.h>

#define CGROUP_FOLDER "/sys/fs/cgroup/pids/container/"
#define concat(a,b) (a"" b)

// update a given file with a string value. 
void write_rule(const char* path, const char* value) {
  int fp = open(path, O_WRONLY | O_APPEND );
  write(fp, value, strlen(value));
  close(fp);
}


void limitProcessCreation() {
  mkdir( PID_CGROUP_FOLDER, S_IRUSR | S_IWUSR);  // Read & Write
  
  //getpid() give us a integer and we transform it to a string.
  const char* pid  = std::to_string(getpid()).c_str();

  write_rule(concat(CGROUP_FOLDER, "cgroup.procs"), pid);
}
```


We've registered our process id, next we need to (write)[https://linux.die.net/man/2/write] to the file ```pids.max ``` limit of processes our children can create, let's try with 5.

```c 
void limitProcessCreation() {
  mkdir( PID_CGROUP_FOLDER, S_IRUSR | S_IWUSR);  // Read & Write
  
  //getpid give us a integer and we transform it to a string.
  const char* pid  = std::to_string(getpid()).c_str();

  write_rule(concat(CGROUP_FOLDER, "cgroup.procs"), pid);
  write_rule(concat(CGROUP_FOLDER, "pids.max"), "5");
}
```

After our process end is a good idea to release the resources, so the kernel can cleanup the container folder we created above, the way to notify this is to update the file ```notify_on_release``` with the value of 1.

```c 
void limitProcessCreation() {
  mkdir( PID_CGROUP_FOLDER, S_IRUSR | S_IWUSR);  // Read & Write
  
  //getpid give us a integer and we transform it to a string.
  const char* pid  = std::to_string(getpid()).c_str();

  write_rule(concat(CGROUP_FOLDER, "cgroup.procs"), pid);
  write_rule(concat(CGROUP_FOLDER, "notify_on_release"), "1");
  write_rule(concat(CGROUP_FOLDER, "pids.max"), "5");
}
```

Now our function is ready to be called from the main program: 

```c
int jail(void *args) {

  limitProcessCreation();
  #...
}
```

We need to call it before we do the change the root folder, this way we can setup the execution context. After we compile and run we should get something like this:

![cgroup](https://github.com/cesarvr/cesarvr.github.io/blob/master/static/containers/cgroup-pid.gif?raw=true)


What I'm trying to do here is to execute an instance of the process sleep, this program require a integer representing the number of second it will execute, I added the ampersand so I can execute multiple instances of the program, when we hit the limit 5, the system automatically refuse to create more processes as expected.


<a name="conclusion"/>

## Wrapping Up 

This was a long post, if you've read this far, I hope you have a better idea of what a container are and how they are created. After what we've learned so far we can answer to some of the typical container questions:  

#### How about performance ?

Yes they are just processes, you can control the how much each container consume by tweaking the cgroup rules. The major orchestrator like [Openshift](https://docs.openshift.com/enterprise/3.2/dev_guide/compute_resources.html) and [Kubernetes](https://kubernetes.io/docs/concepts/configuration/manage-compute-resources-container/) offer an interface for this. After reading this article we should know how they achieve this trick :).   

####  What's the difference between VM and Containers ?

VM basically try to emulate a computer completely, including Bios, CPU, Memory,etc. While containers are just a special type of process. 

#### Are containers faster than VM ?

It depends but in my opinion even when VM uses specials CPU instructions to get a very close to the metal speed, you're still executing a bunch of OS libraries on top which I believe can add some overhead. While in the container you just (or you should) run only your process and it's dependencies. 


#### Can I use VM and containers ? 

Why not?, I just use that combination to write this article. 


