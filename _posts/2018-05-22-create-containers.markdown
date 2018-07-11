---
date: "2018-05-22"
title: "How Linux Containers Works"
layout: post
---


<!--ts-->
   * [Getting Started](#getting_started)
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
       - [Cleanup](#cleanup)
   * [Control Group](#cgroup)
   * [Wrapping Up](#conclusion)
<!--te-->


<a name="getting_started"/>

## Getting Started

So what is this article about? Is basically about how to create your own container program using C. In this article we are going to review the technology and principles that make the isolation of processes a reality in Linux.  

Why you should read it? Well I really love to see how things works behind the scene and also having a good knowledge of how containers works can help you to do more experimentation or prepare better for contingency.

Inspiration for this post comes from a [talk](https://www.youtube.com/watch?v=_TsSmSu57Zo) of [Liz Rice](https://twitter.com/lizrice). I think she really nails the point and was super informative. I just basically replicate what she did in Golang in C and document it in this post. But why C? because I love the simplicity of that language (I'm a little romantic) and also is the lingua franca of Linux which mean it would help me to get a better understanding about how things work at system level. 

Enough of introduction let's write our container, which mean we are creating a program that isolate other programs, we are going to start by writing the obligatory *Hello World*. 

```c++
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

First parameter is our entry point function, *second* parameter is a function to allocate some stack memory for our process, *third* (SIGCHLD) we are telling the Linux that we want the parent to be notified when this process finish and the purpose of the *fourth* and last one, necessary if we want to pass arguments to the ```jail``` in this case we pass just ```0```. 


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



<a name="programs"/>

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


<a name="env"/>

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


<a name="linuxns"/>

## Linux Namespaces

<a name="uts"/>

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

<a name="pidns"/>

### Process Identification NS

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


<a name="fsns"/>
## Isolating A File System 

<a name="chroot"/>

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


```c++ 
void setup_root(const char* folder){
  chroot(folder);
  chdir("/");
}
```   

For this we are going to hide the complexity behind a function called ```setupFileSystem``` then we change the root of the folder using [chroot](http://man7.org/linux/man-pages/man2/chroot.2.html) and last but not least tell the process to jump to the new root folder.

<a name="prepare" />

#### Preparing The Root Folder

We can change the root to an empty folder but if we do that we are going to loose the tools we are using so far to inspect the quality of our container (ls, cd, etc..), to avoid this we need to get some Linux base folder that include all this tools. I'll choose [Alpine Linux](https://github.com/yobasystems/alpine) because is very minimal, about 2MB compressed.

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

To solve our process visibility meaning to been able to watch processes that runs inside our container, we need to learn how to mount files system inside our containers, to do this is not different from doing it using shell we need to make a system call to the instruction [mount](http://man7.org/linux/man-pages/man2/mount.2.html).


The mount instruction require the following parameters: 

```c
mount("proc", "/proc", "proc", 0, 0);
``` 

The first parameter is the source, the second is the folder destination and the third parameter is the type of file system in this case [procfs](https://en.wikipedia.org/wiki/Procfs). 


Implementing the code is as simple as to add that same line before we load the new process image (```sh```), something like this will work: 

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

### Cleanup 

But there is a problem, every time we run this we are going to clutter the mount name space, we are mounting successfully the file system, but we are failing to release it, to release the resource we need to use [umount](http://man7.org/linux/man-pages/man2/umount.2.html).  

```c
umount("<mounted-folder>")
```

And we should write this after we load the executable: 

```c
  mount("proc", "/proc", "proc", 0, 0);
  
  run("/bin/sh");

  umount("/proc"); 
  return EXIT_SUCCESS;
```

But this won't work because every time we call ```run``` our process get replaced by a new process image and we still won't be able to call ```umount```, basically the instructions are going to stop in ```run``` and from there ```sh``` is in control, to solve this we need to decouple this call from the rest of the function. As we learn above to run a function in a separated process in Linux we use [clone](http://man7.org/linux/man-pages/man2/clone.2.html), knowing this we are going to refactor our code.   

Let's start by grouping our process creation instruction into a reusable function: 

We re-write this: 

```c 
int main(int argc, char** argv) {
  printf("parent %d", getpid());

  clone(child, stack_memory(), CLONE_NEWPID | CLONE_NEWUTS | SIGCHLD, 0);
  wait(nullptr);

  return EXIT_SUCCESS;
}
```

Into this: 

```c 
template <typename Function>
void clone_process(Function&& function, int flags){
 auto pid = clone(function, stack_memory(), flags, 0);

 wait(nullptr);
}
```

Here, I'm using a C++ template, I make a new "type" called **Function** which expect a C function to be passed then I just pass that value to [clone](http://man7.org/linux/man-pages/man2/clone.2.html). 


To use our function we just re-write our *main* function: 

```c
int main(int argc, char** argv) {

  printf("parent pid: %d\n", getpid());
  clone_process(jail, CLONE_NEWPID | CLONE_NEWUTS | SIGCHLD );

  return EXIT_SUCCESS;
}
```

Nice, now we have a reusable function, now let's use this function to run our binary in a child-process: 


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

Here we just a C++ feature called ([Lambda](https://en.cppreference.com/w/cpp/language/lambda)) which basically translate to something like this: 

```c
int runThis(void*args) {

  run("/bin/sh"); 
}

int jail(void *args) {
...
...

clone_process(runThis, SIGCHLD);
}
```

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

Now our program is capable to mount successfully the proc system file, release the file system after we exit and the best thing is now our process only have access to process local to itself. 

#### Explanation

When we create the child process (```jail```) we used the flag ```CLONE_NEWPID```, this flag change our process view of the process tree, that's why when we ask [getpid](http://man7.org/linux/man-pages/man2/getpid.2.html) it will return **1** and when we mount [procfs](https://en.wikipedia.org/wiki/Procfs) it will report only direct child processes from our container application.   

This is what I got when I call ```ps```. 

```sh
PID   USER     TIME   COMMAND
    1 root       0:00 ./container
    2 root       0:00 /bin/sh
```

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

This was a huge post, if you have readed this far I hope you have a better idea of what a container are. They are just isolated Linux processes and by knowing this you can answer a lot of the typical questions like:  

### How about performance ?

Yes they are just processes, if you have some rules in cgroup about CPU or memory they can affect performance.
  
### What's the difference between VM and Containers ?

VM basically try to emulate a computer completely, while containers are just a special type of process. 

### Are containers faster than VM ?

It depends but in my opinion even when VM uses the CPU instructions to get a very close to the metal speed, you're still executing a bunch of OS libraries on top which I believe can add some overhead. While in the container you just (or you should) run only your process and it's dependencies. 


### Can I use VM and containers ? 

Why not?, I just use that combination to write this article. 


