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

  return EXIT_SUCCESS;
}
```

You compile this code into a machine readable binary. I'll call it *container*. We are going to use the GNU C++ compiler because it allows some syntactic sugar:

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

Now we have two processes executing two different tasks, but there is a problem. For our program to be useful we need to recover the information once the child process finishes. One way to sync the two processes is to stop the parent process using ```wait```. 

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

int child(void *args) {
  printf("Hello !! ( child ) \n");
  // BENGT TO CESAR: Return type is int but here you don't return anything???
}

int main(int argc, char** argv) {
  printf("Hello, world! ( parent ) \n");

  TRY(clone(child, stack_memory(), SIGCHLD, 0), "clone");

  wait(nullptr);
  return EXIT_SUCCESS;
}
```

We just added a new function called *child* and are using the ```clone``` and ```wait``` system calls. If we would compile and run our code we should get:


```sh
./container
#Hello World (from parent)
#Hello World (from child)
// BENGT TO CESAR: Wrong output, at L100 it says "printf("Hello !! ( child ) \n");", so output should be "Hello !! ( child )"?
```

## Setting Up

Now we are going to start testing the concepts behind containers. To do this we are going to execute a shell that will replace the child process.  

```c++
int child(void *args) {
  printf("pid: %d\n", getpid());
  execvp("/bin/sh", {});
}

```

BENGT TO CESAR: Perhaps you shou;d explain a little more what the ```execvp``` function does or just link to some documentation? First time I came across it. 😅

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

### Isolation

A virtual machine achieves this isolation by simulating the whole computer (CPU, I/O, BIOS, etc..), the Linux Kernel, by providing the technology to modify the way processes behave. In the next section we are going to modify our program to make use of these features. 


#### Environment Variables

The first thing I would like to change is the environment variables. After we clone the process we inherit all the environment variables. This an ugly leak of information, so let's solve that by using the a simple POSIX ```clearenv```. 

```c++
int child(void *args) {
  printf("pid: %d\n", getpid());

  clearenv();   // remove all env variables for this process.

  execvp("/bin/sh", {});
}
```

We run the code again and tell the shell to execute the command ```env```:

```sh
  # env
  SHLVL=1
  PWD=/
```

Not bad. We now have our own set of variables for this process.


#### UTS

In this scenario when we clone our child process, we are going to provide its own UTS Namespace. When we do this, Linux will provide to our child process its own *Hostname* and *Domain*, and those will be independent from the system. 

We achieve this by adding the ```CLONE_NEWUTS``` flag to the clone system call:

```c++
int main(int argc, char** argv) {
  TRY( clone(child, stack_memory(), CLONE_NEWUTS | SIGCHLD, 0), "clone" );
  //                                 ^^ new flag
  wait(nullptr);
  return EXIT_SUCCESS;
}
```

Now lets prove our hypothesis. The first thing we need is to recompile and execute our program:

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

Now it works, so now we can use bash to attempt to change the machine name:

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

#### Isolating File System

The objective now is to isolate the access to the files our process can access. To achieve that we are going to change the root folder of our cloned process by using the good old ```chroot```, but this time instead of the command we are going to use the equivalent system call.


#### Preparing The Root Folder
We can change the root tosh an empty folder but if we do that we are going to lose the tools we are using so far to inspect the quality of our container. To avoid this we need to get some Linux base folder that includes the necessary tools. I'll choose [Alpine Linux](https://github.com/yobasystems/alpine) because it's very minimal; around 2MB compressed and has essential tools.

Just grab the base [install](alpine-minirootfs-3.7.0_rc1-x86_64.tar.gz): 

```sh
mkdir root && cd root
curl -Ol http://nl.alpinelinux.org/alpine/v3.7/releases/
```

Uncompress it into a folder called ```root``` at the same level of our binary.

```sh
x86_64/alpine-minirootfs-3.7.0_rc1-x86_64.tar.gz
tar -xvf alpine-minirootfs-3.7.0_rc1-x86_64.tar.gz
```


#### Changing The Root Folder

The changes we need to do are fairly simple. We are going to make a call to **chroot** passing the ```root``` folder containing basic folder structure:

```c++
 chroot("./root"); // point to your downloaded base folder.
```

We change the process directory to the new rooted location ```chdir(/)```:
```c++
 chdir("/"); // point to root folder /.
```

We group these two behaviours into a single function.

```c++
void setupFileSystem(){
  chroot("./root");
  chdir("/");
} 
```

Once migrated to the new root folder, we need to tell our shell where to find the tools we need (ls, ps, clear, etc..), and information about the screen. We also move all this functionality to its own function. 

```c++ 
void setupEnvVars() {
  clearenv();
  setenv("TERM", "xterm-256color", 0);
  setenv("PATH", "/bin/:/sbin/:usr/bin:/usr/sbin", 0);
}
```

After we change the root folder we need to pass more information to the system call in charge of loading the program. So we group this logic as well: 

```c++ 
int run(const char *name) {
  char *_args[] = {(char *)name, (char *)0 };
  execvp(name, _args);
}
```

The code for the child process now looks like this: 

```cpp
void setupEnvVars() {
  clearenv();
  setenv("TERM", "xterm-256color", 0);
  setenv("PATH", "/bin/:/sbin/:usr/bin:/usr/sbin", 0);
}

void setupFileSystem(){
  chroot("./root");
  chdir("/");
}

int child(void *args) {
  printf("pid: %d\n", getpid());
  setHostName("my-container");
  setupFileSystem();
  setupEnvVars();
  run("/bin/sh"); 
}
```


#### Mounting file system into our container

But happiness is not reached yet. If we run our contained process and run ```ps``` look at what we would find:

```
PID TTY          TIME CMD
```

It seems that we don't have any process running. The problem is that when we change the root folder, we stop using the global ```/proc``` directory and our child process is using the empty one available in the distribution. This directory is the place where Linux mounts the **procfs** pseudo-filesystem.

##### Reusability Lesson

The [procfs](https://en.wikipedia.org/wiki/Procfs) filesystem doesn't represent a part of your disk or any storage at all. Linux follows the Unix principle of "everything is a file", so instead of creating new interfaces to share information they use the folder/files metaphors to communicate information to the user.

##### Mounting Procfs

The system call [mount](http://man7.org/linux/man-pages/man2/mount.2.html) would look like this:

```c++
mount("proc", "/proc", "proc", 0, 0);
```

This method receives the resource we want to mount, then we pass the folder pointing to the ```/proc``` folder and the filesystem type which is ```proc```.

```c++
createChild([](void *args) -> int {
      // ...
      chdir("/"); // point to root folder /.
      sethostname(hostname.c_str(), hostname.size());

      mount("proc", "/proc", "proc", 0, 0);

      execvp({"/bin/sh"}, {});
  }, CLONE_NEWUTS | CLONE_NEWPID | SIGCHLD);
```

We compile and run our program and then we run ```ps```:

```
process created with pid: 8238
current process id: 1
/ # ps
PID   USER     TIME   COMMAND
    1 root       0:00 /bin/sh
    2 root       0:00 ps
```

If we pay close attention we see that this process tree looks unique to our context. This is because now we are noticing the full effect off having assigned to our child process a new process tree as we did above by using the flag ``` CLONE_NEWPID ```.


##### Control Groups
