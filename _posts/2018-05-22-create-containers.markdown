---
date: "2018-05-22"
title: "How Linux Containers Works"
layout: post
---

# How Linux Containers Works

Containers is one of the hottest technologies at the moment, but sometimes they are misunderstood. So inspired by the [talk](https://www.youtube.com/watch?v=_TsSmSu57Zo) of [Liz Rice](https://twitter.com/lizrice), about the technology behind containers, I decided to write a post about the steps involved in container creation to help others gain a better understanding. I would basically follow what [Liz Rice](https://twitter.com/lizrice) did in her video but use C/C++ instead which interfaces naturally with Linux. This way it became clear to me what interactions are necessary with the Linux Kernel to achieve this process isolation. I hope you enjoy it as much as I enjoyed researching about it.


## Linux process

Let's start with the first piece of the puzzle by defining what a process is. A process, in simple terms is just the instantiation of binary code; usually a program into the memory.

Basically you have some human readable code like this:

```c++
#include <iostream>

int main(int argc, char** argv) {
  printf("Hello, world! \n");

  return EXIT_SUCCESS; // this is a integer constant equals 0, in Unix/Linux is success. 
}
```

You compile this code into a machine readable binary. We are going to use the GNU C++ compiler because it allows some syntactic sugar:

```sh
g++ container.cc -o container  
```

Now test our binary:

```sh
./container   
# Hello World!
```

The binary will get loaded into memory and become a *process*. The process writes ``` Hello World ``` into the standard output stream and exits.


## Cloning processes

Cloning a process in Linux works like this. Let's say you execute a program with two functions; **fn_a** and **fn_b**. We want to execute these two functions in parallel: 

``` 
  +---------+
  | process |
  |---------|
  |  fn_a   |
  |---------|
  |  fn_b   |
  +---------+

```

One way to do this is to clone the process and dump the task we want to run in parallel, in this case **fn_b**. 

``` 

  +---------+         +---------+     
  | process |         |  child  |
  |---------|         |---------|
  |  fn_a   |         |         |
  |---------|  clone  |---------|  
  |  fn_b   |  ---->  |  fn_b   |  fn_b get executed in parallel.
  +---------+         +---------+

```

When the cloned process finish the task the system send a termination signal SIGCHLD, that optionally should be captured by the parent process.


``` 

  +---------+         +---------+     
  | process |         |  child  |
  |---------|         |---------|
  |  fn_a   |         |         |
  |---------| SIGCHLD |---------|  
  |  fn_b   |  <---   |  fn_b   |  finish.
  +---------+         +---------+

```

The parent process then can proceed with other operations. 


What this has to do with containers at all?, well containers works in part by modifying the process creation and adding layer of isolation in top of that. 

Let's stop with theory and do some coding, first of all we need to implement a mechanism to create a new process.

First we need a function entry point let's called ```childEntryPoint```. 

```c++ 
int childEntryPoint(void *args) {
  printf("Hello !! ( child ) \n");
  return EXIT_SUCCESS;  
}
```

Now we need to tell Kernel that we want to clone our process and we want this new process to use the above function as its entry point, Linux expose a service called [clone](http://man7.org/linux/man-pages/man2/clone.2.html) for this purposes. 

```c++ 
clone(childEntryPoint, stack_memory(), SIGCHLD, 0)
``` 

First parameter is our entry point function, second parameter we need to allocate some stack memory four our process, so don't worry about that at the moment, third (SIGCHLD) we are telling the Linux that we want the parent to be notified when this process finish and the last one is arguments we want to pass we pass zero here. 


Then we need are going to tell our program to stop and wait for the child process to finish, the function [wait](http://man7.org/linux/man-pages/man2/wait.2.html) does just that.

```c++ 
 wait(nullptr); //wait for every child.
``` 

Let's look at all of this in code:


```c++
#include <iostream>
#include <sched.h>
#include <sys/types.h>
#include <unistd.h>
#include <sys/wait.h>

// Sanity check function. 
void TRY(int status, const char *msg) {
 if(status == -1) {
    perror(msg);
    exit(EXIT_FAILURE);
 }
}

int childEntryPoint(void *args) {
  printf("Hello !! ( child ) \n");
  return EXIT_SUCCESS;
}

int main(int argc, char** argv) {
  printf("Hello, World! ( parent ) \n");

  TRY(clone(childEntryPoint, stack_memory(), SIGCHLD, 0), "clone");

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

Excellent, we put the first stone to create our Linux container. 


## Shell 

Now what we want to do is to load some real process inside after all we want to containerize applications so we need a guinea pig. So a good program to inspect the quality of our container is the shell because allow us to execute some commands to proof our advances. 

Without further ado let's write the code to load the shell program, for this purposes we are going to use [execvp](https://linux.die.net/man/3/execvp).

```c++
execvp("<path-to-executable>", {array-of-parameters-including-executable});
```
The syntax to run the program will look something like this: 

```c++
char *_args[] = {"/bin/sh", (char *)0 };
execvp("/bin/sh", _args);
```

To make look nicer we are going to wrap this into a nice function. 

```c++
//we can call it like this: run("/bin/sh"); 
int run(const char *name) {
  char *_args[] = {(char *)name, (char *)0 };
  execvp(name, _args);
}
```

This version should be enough for our purposes, but for fun I just write this alternative version that accepts multiple parameters using some C++ templates. 

```c++ 
//we can call it like this: run("/bin/sh","-c", "echo hello!");  
template <typename... P>
int run(P... params) {
  //basically generating the arguments array at compile time. 
  char *args[] = {(char *)params..., (char *)0};

  return execvp(args[0], args);
}
```

Now that we got our function this is how the code looks at the end. 

```c++
int childEntryPoint(void *args) {
  printf("pid: %d\n", getpid());
  run("/bin/sh");
  return EXIT_SUCCESS;
}
```


When we run this should get: 

```
process created with pid: 12406
sh-4.4$
```

This is how the process looks like: 

``` 
         Parent                 child process               child process   
  +-------------------+          +---------+                 +---------+ 
  |       main()      |          | code... |                 |         | 
  |-------------------| clone -> | ...     |  replaced by -> | /bin/sh |   
  | childEntryPoint() |          | run()   |                 |         |
  +-------------------+          +---------+                 +---------+
```

Once we execute ```execpv``` the program we load and replace our ```childEntrypoint``` in memory. Now the trick is to modify the execution context so the program we execute (```/bin/sh``` in this case) inherit those changes. 


#### Environment Variables


Let's write a simple example of what I mean by modifying the execution context, when we clone our process the child will inherit the environment variables of the parent. To solve this leak, we can modify the environment variables. 

So before we pass the control to ```/bin/sh``` we delete all the environment variables using the function [clearenv](https://linux.die.net/man/3/clearenv). 

```c++
int child(void *args) {
  printf("pid: %d\n", getpid());

  clearenv();   // remove all env variables for this process.

  execvp("/bin/sh", {});
  return EXIT_SUCCESS;
}
```

We run the code again and inside the shell we run the command ```env```:

```sh
  # env
  SHLVL=1
  PWD=/
```

Not bad, we've solved the information leak.


#### Universal Time Sharing

Imagine an scenario where we have a program that need to change the hostname work, if you execute that program in your machine it can mess with other programs, like some network file sharing services. To solve that problem we are going to add a new feature to our containment technology.    

Before we continue we need to talk a little bit about [Linux Namespaces](https://en.wikipedia.org/wiki/Linux_namespaces).

Here is a quick illustration. 

``` 
                  Linux Kernel
 +-----------------------------------------------+
 
            Global Namespace { UTS, ... }
 +-----------------------------------------------+
 
         parent                   child process        
  +-------------------+            +---------+       
  |                   |            |         |
  | childEntryPoint() | clone -->  | /bin/sh |   
  |                   |            |         |
  +-------------------+            +---------+
```

All the processes in the system including those two share the same UTS Namespace. We need to ask the Linux Kernel to provide a new UTS context.  


``` 
                  Linux Kernel
 +-----------------------------------------------+
 
  Global Namespace { UTS, ... }              UTS
 +-----------------------------+      +----------------+
                                            
         parent                         child process        
  +-------------------+                  +---------+       
  |                   |                  |         |
  | childEntryPoint() |    clone -->     | /bin/sh |   
  |                   |                  |         |
  +-------------------+                  +---------+
```

Thanks to this, changes to the hostname done by ```/bin/bash``` would be isolated from the rest.



To get this new context for our process is as simple as to pass the ```CLONE_NEWUTS``` flag to [clone](http://man7.org/linux/man-pages/man2/clone.2.html).

```c++
int main(int argc, char** argv) {
  TRY( clone(child, stack_memory(), CLONE_NEWUTS | SIGCHLD, 0), "clone" );
  //                                 ^^ new flag
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

Now it works, let's try to modify the hostname:

 ```sh
 sh-4.4# hostname my-container
 ```
 
This change stays local to our cloned process **sh**. You can verify this by opening a new terminal and check the hostname.

```sh
[bash]: hostname  # should print your hostname.
```



[video here]


#### Cloning PID.

When your machine boots up, the first process to start is the [daemon init](https://en.wikipedia.org/wiki/Init) process with identifier 1. This process then acts as the parent for every other process on your machine. Our goal is to isolate our process from this general process tree and make it look like it's the only process on the machine.

We need to add the ```CLONE_NEWPID``` flag:

 ```c++
int main(int argc, char** argv) {
  TRY( clone(child, stack_memory(), CLONE_NEWPID | CLONE_NEWUTS | SIGCHLD, 0), "clone" );
  //                                ^^ new flag
  wait(nullptr);
  return EXIT_SUCCESS;
}
 ```

Compile and run:

```sh
sudo ./container                              
process created with pid: 2045 # this one belongs to the main tree (the one started by init).
current process id: 1 # Now our process is number 1. This process is the parent of its "own" tree.
sh-4.4#
```

[video here]


If you run **ps** you still see processes of the main tree. 

```sh
  PID TTY          TIME CMD
12042 pts/0    00:00:00 sudo
12043 pts/0    00:00:00 container
12044 pts/0    00:00:00 sh
12045 pts/0    00:00:00 ps
```
This happen because **ps** gets its information from the **proc** directory. We are going to take care of this in the following section.



