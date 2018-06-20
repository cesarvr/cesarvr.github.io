---
date: "2018-05-22"
title: "How Linux Containers Works"
layout: post
---

# How Linux Containers Works

Containers is one of the hottest technologies at the moment, but sometimes they are misunderstood, so inspired by the [talk](https://www.youtube.com/watch?v=_TsSmSu57Zo) of [Liz Rice](https://twitter.com/lizrice) about the technology behind containers. I decided to write a post about the steps involved in the container creation in the hope that help me understand how it works and also helps other peoples to have a better understanding. I would basically follow what [Liz Rice](https://twitter.com/lizrice) did in her video but using C/C++ which interface naturally with Linux, so for me is clear what interactions are necessary with the Linux Kernel to achieve this process isolation, hope you enjoy as much as I enjoy researching about it.


## Linux process

Let's start by the first piece of the puzzle by defining what a process is, a process, in simple terms is just the instantiation of binary code usually a program into the memory.

Basically you have some human readable code like this one.

```c++
#include <iostream>

int main(int argc, char** argv) {
  printf("Hello, world! \n");

  return EXIT_SUCCESS;
}
```

You compile this code into a machine readable binary. I'll call it *container*, we are going to use C++ compiler because it allows some syntactic sugar.

```sh
g++ container.cc -o container  
```

Now test our process.

```sh
./container   
# Hello World!
```

The binary will get loaded into memory and become a process, the process write ``` Hello World ``` into the standard output back and exit.


## Cloning processes

Cloning a process in Linux work like this, let say you execute program with two functions **fn_a** and **fn_b** and we want to execute this two functions in parallel. 

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

```c++
  clone(fn_b, stack_memory(), SIGCHLD, 0);
``` 

The ```clone``` system call achieve that purpose. 

``` 

  +---------+         +---------+     
  | process |         |  child  |
  |---------|         |---------|
  |  fn_a   |         |         |
  |---------|  clone  |---------|  
  |  fn_b   |  ---->  |  fn_b   |  fn_b get executed in parallel.
  +---------+         +---------+

```

Now we have two processes executing two different task, but there is a problem for our program to be useful we need to recover the information once the child process finish, one way to sync the two processes is to stop the parent process using ```wait``` . 

Let's look all this in code. 


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

int child(void *args) {
  printf("Hello !! ( child ) \n");
}

int main(int argc, char** argv) {
  printf("Hello, world! ( parent ) \n");

  TRY( clone(child, stack_memory(), SIGCHLD, 0), "clone" );

  wait(nullptr);
  return EXIT_SUCCESS;
}
```

Just added to our code a new function called *child* and the ```clone``` and ```wait``` system call. We compile or code and run it we should get.


```sh
./container
#Hello World (from parent)
#Hello World (from child)
```

## Setting Up

Now we are going to start testing the concepts behind containers, to do this we are going to execute a shell that will replace the child process.  

```c++
int child(void *args) {
  printf("pid: %d\n", getpid());
  execvp("/bin/sh", {});
}

```

Here we just clean up our child function, print the process id and run our shell program. 

When we run we should get this: 

```
process created with pid: 12406
sh-4.4$
```

Process hierarchy: 

``` 

  +---------+          +---------+     
  | process |          | child() |
  |---------|          |---------|
  | child() | clone -> |   sh    |
  +---------+          +---------+ 

```

#### Isolation

Virtual Machine achieve this isolation by simulating the whole computer (CPU, I/O, BIOS, etc..), Linux Kernel by providing the technology to modify the way process behave. In the next section we are going to modify our program to make use of this features. 


#### Environment Variables

The first thing I would like to change is the environment variables, after we clone the process we inherit all the environment variables, this a ugly leak of information so let's solve that. 
 
To solve this I would use the a simple POSIX ```clearenv```. 

```cpp
int child(void *args) {
  printf("pid: %d\n", getpid());

  clearenv();   // remove all env variables for this process.

  execvp("/bin/sh", {});
}
```

We run the code again and enter the shell execute ```env```:

```sh
  # env
  SHLVL=1
  PWD=/
```

Not bad, we have our own set of variables for this process.


#### UTS

In this scenario when we clone our child process we are going to provide its own UTS Namespace, when we do this Linux will provide to our child process its own *Hostname* and *Domain* and those will be independent from the system. 

We achieve this by adding the ```CLONE_NEWUTS``` flag to the clone system call.  

```cpp
int main(int argc, char** argv) {
  TRY( clone(child, stack_memory(), CLONE_NEWUTS | SIGCHLD, 0), "clone" );
  #                                 ^^ new flag
  wait(nullptr);
  return EXIT_SUCCESS;
}
```

Now lets proof our hypothesis, the first thing we need is to recompile and execute our program.

```sh
./container                                                     
error: clone(): Operation not permitted
```

This happens because what we try to do (cloning the UTS namespace) require [CAP_SYS_ADMIN](https://lwn.net/Articles/486306/) or in other words we need elevated privilege.

```
sudo ./container                                      
[sudo] password for cesar:
process created with pid: 12906
sh-4.4#
```

Now it works and now we can use bash to try to change machine name.

 ```
 sh-4.4# hostname my-container

 ```
That this change stay local to our cloned process **sh**, you can verify this by opening a new terminal and checking the hostname.

```
[bash]: hostname  # should print your hostname.
```

[video here]


#### Cloning PID.

When your machine boot up, the first process to start is the [daemon init](https://en.wikipedia.org/wiki/Init) process with identifier 1, this process then act as the parent for every other process in your machine. Our goal is to isolate our process from this general process tree and make it look its the only process in the machine.

We need to add the ```CLONE_NEWPID``` flag.

 ```cpp
int main(int argc, char** argv) {
  TRY( clone(child, stack_memory(), CLONE_NEWPID | CLONE_NEWUTS | SIGCHLD, 0), "clone" );
  #                                 ^^ new flag
  wait(nullptr);
  return EXIT_SUCCESS;
}
 ```

Compile and run.

```sh
sudo ./container                              
process created with pid: 2045 # this one belong to the main tree (the one started by init).
current process id: 1 # Now our process is number 1, this process is the parent of it's "own" tree.
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
This happen because **ps** get its information from the **proc** directory, we are going to take care of this in the following section.

#### Isolating File System

The objective now is to isolate the access to the files our process can access, to achieve that we are going to change the root folder of our cloned process by using the good old ```chroot``` but this time instead of the command we are going to use the equivalent system call.  


#### Preparing The Root Folder
We can change the root to an empty folder but if we do that we are going to loose the tools we are using so far to inspect the quality of our container, to avoid this we need to get some Linux base folder that include the necessary tools. I'll choose [Alpine Linux](https://github.com/yobasystems/alpine) because is very minimal is about 2MB compressed and has essential tools.

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


#### Changing The Root Folder

The changes we need to do are fairly simple, we are going to make a call to **chroot** passing the ```root``` folder containing basic folder structure.

```
 chroot("./root"); //point to your downloaded base folder.
```

We change the process directory to the new rooted location ```chdir(/)```.
```c++
 chdir("/"); // point to root folder /.
```


The code for the child process now looks like this: 

```cpp
int child(void *args) {
  printf("pid: %d\n", getpid());
  setHostName("my-container");
  clearenv();
  chroot("./root");
  chdir("/");

  execvp("/bin/sh", {});
}
```



#### Mounting file system into our container

But happiness is not complete yet, if we run our contained process and run ```ps``` look what we found.

```
PID TTY          TIME CMD
```

It seems that we don't have any process running, the problem is that when we change the root folder, we stop using the global ```/proc``` directory and our child process is using the empty one available in the distribution, this directory is the place where Linux mounts the **procfs** pseudo-filesystem.

##### Reusability Lesson

The [procfs](https://en.wikipedia.org/wiki/Procfs) filesystem doesn't represent a part of your disk or any storage at all, Linux follows the Unix principle of "everything is a file", so instead of creating new interfaces to share information they use the folder/files metaphors to communicate information to the user.

##### Mounting Procfs

The system call [mount](http://man7.org/linux/man-pages/man2/mount.2.html) our call will look like this:

```cpp
mount("proc", "/proc", "proc", 0, 0);
```
This method receive the resource we want to mount, the we pass the folder pointing to the ```/proc``` folder and the filesystem type which is ```proc```.  

```cpp
createChild([](void *args) -> int {
      #...
      chdir("/"); // point to root folder /.
      sethostname(hostname.c_str(), hostname.size());

      mount("proc", "/proc", "proc", 0, 0);

      execvp({"/bin/sh"}, {});
  }, CLONE_NEWUTS | CLONE_NEWPID | SIGCHLD);
```

We compile and run our program and then we run ``` ps ```.

```
process created with pid: 8238
current process id: 1
/ # ps
PID   USER     TIME   COMMAND
    1 root       0:00 /bin/sh
    2 root       0:00 ps
```

If we pay close attention we see that this process tree looks unique to our context, this is because now we are noticing the full effect off having assigned to our child process a new process tree as we did above by using the flag ``` CLONE_NEWPID ```.


##### Control Groups
