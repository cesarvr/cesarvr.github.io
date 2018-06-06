---
date: "2018-05-22"
title: "How Linux Containers Works"
layout: post
---

# How Linux Containers Works

Containers is one of the hottest technologies at the moment, but sometimes they are misunderstood, so inspired by the [talk](https://www.youtube.com/watch?v=_TsSmSu57Zo) of [Liz Rice](https://twitter.com/lizrice) about the technology behind containers. I decided to write a post about the steps involved in the container creation in the hope that help people create maybe a better definition of what a container is.


## Linux process

A process in simple terms is just the instantiation of binary code usually a program into the memory.

Basically you have some code, in this case I'll use C++.

```c++
#include <iostream>
using namespace std;

int main(int argc, char* argv[]){
  cout << "Hello World" << endl;
  return 0;
}
```

You compile this code into a binary, I'll choose an original name, let's call it container.

```sh
g++ container.cc -o container  
```

Now let's create the process.

```sh
./container   
# Hello World!
```

The process will get instantiated, execute the instruction to pass some words to the Linux standard output and exit.


## Child processes

One of the features of Linux (and the other of commercial OS) is that process can create other processes, basically if you have a process with function **a** and **b** you can clone this process and execute **function b**, while the parent can take care of executing **function a**, the parent need to handle this branching but it can take advantage of multiple cores.

Quick example:

```c++
template<typename AnonymousFunction>
void createChildProcess(AnonymousFunction &&action, int flags) {
  auto pid = clone(action, allocStackMemory(), flags, 0);
  #...
  waitForChilds();
}

int main(int argc, char* argv[]){
  cout << "Hello World (from parent)"
  createChildProcess( [](void *args) -> int {
    cout << " Hello World (from child)" << endl;
  }, SIGCHLD);

  return 0;
}
```

Let's explain some of the C++ black magic:

```
[](void *args) -> int {

}
```
Don't be afraid by that incantation, is just an [Anonymous functions](https://en.wikipedia.org/wiki/Anonymous_function), in C++ they are called lambda expressions.

```cpp
void createChildProcess(AnonymousFunction &&action, int flags) {
  auto pid = clone(action, allocStackMemory(), flags, 0);
  #...

}
```

Here we just created a function called **createChildProcess** that receive an Anonymous function, it works by cloning the actual process and passing it the "task" in the form of Anonymous function.

After we compile or code and run it we get.

```sh

./container
#Hello World (from parent)
#Hello World (from child)
```

## Fake it until you make it

#### Executing our child program
Let's start our virtualization journey, we need a process powerful enough to allow us to test, how good our jail is, so for this purpose let's choose ```sh```.   

```
createChild([](void *args) -> int {
    run("/bin/bash");
}, SIGCHLD);
```

Now we created bash as our child process, if we execute our program we should got this.

```
process created with pid: 12406
sh-4.4$
```


#### Isolating the environment variables

first we going to start with some simple isolation like environment variables, if you run ``` env ``` right know you would see that we are inheriting our parent process env vars let solve that problem.

```cpp
createChild([](void *args) -> int {
    clearenv();
    run("/bin/bash");
}, SIGCHLD);
```
That was easy, we are clearing the vars before start but hey, its a good start.


#### Isolating the Universal Time System (UTS)

Next we are going to isolate the Universal Time Sharing (UTS) feature in Linux,  basically we are going to make our process believe he is working in other machine at least from the point of view of its Hostname.

We are going to achieve this by adding a new flag through our beautiful high level interface ```createChild```, this flag is called ```CLONE_NEWUTS```, it tell the Kernel that we also want to assign a cloned UTS for our chilld process.  

```cpp
createChild([](void *args) -> int {
    clearenv();
    run("/bin/bash");
}, CLONE_NEWUTS | SIGCHLD);
```

Now lets proof our hypothesis, the first thing we need is to recompile and execute our program.

```
./container                                                     
error: clone(): Operation not permitted
```

This happens because what we try to do (cloning the UTS namespace) require elevated privilege.

```
sudo ./container                                      
[sudo] password for cesar:
process created with pid: 12906
sh-4.4#
```

It works and now you can change the hostname inside your isolate space.

 ```
 sh-4.4# hostname my-container
 ```
And you will see, that this change only affect the lifetime of the bash process which at the same time is the lifetime of our process tree, outside everything stay the same.



//TODO better title
#### Making our process the only one.  

Each time you execute a program in Linux the system grant this process and id and then attach if your process do not have any parent it get attached to the initial process which has PID number one, we can consider this the parent of all the process in the system, so our next virtualization step is to make our process believe he is running alone in the machine, we are going to make our process the number one.

 This one is easy we just need to add a flag to clone so our process get its own PID tree, separated from the rest.

 ```cpp
 createChild([](void *args) -> int {
    cout << "current process id: " << getpid() << endl;

    clearenv();
    string hostname = "my-container";
    sethostname(hostname.c_str(), hostname.size());
    run("/bin/sh");

  }, CLONE_NEWUTS | CLONE_NEWPID | SIGCHLD);
 ```

The important thing here is to check ```CLONE_NEWPID``` this will give our process a new tree making it feel unique. To test this hypothesis I added this:

```cpp
 createChild([](void *args) -> int {
  cout << "current process id: " << getpid() << endl;
```

This will print the PID of the process in after it get cloned. And as we expected we should see:

```sh
sudo ./container                              
process created with pid: 2045 # this one belong to container.
current process id: 1 # this one belong to the Anonymous Function.
sh-4.4#
```



#### Changing the root folder

Our new objective is to contain the access to the files our process can access, to achieve that, we need to get the typical base folder installation from our favorite Linux distribution, in this article I'll choose [Alpine Linux](https://github.com/yobasystems/alpine) because is very minimal 2MB compressed.

Just grab the base install [gz/tar file](alpine-minirootfs-3.7.0_rc1-x86_64.tar.gz) and we are ready to contain our process inside.

Getting the file is easy just follow this instructions.

```
mkdir root && cd root
curl -Ol http://nl.alpinelinux.org/alpine/v3.7/releases/x86_64/alpine-minirootfs-3.7.0_rc1-x86_64.tar.gz
tar -xvf alpine-minirootfs-3.7.0_rc1-x86_64.tar.gz
rm alpine-minirootfs-3.7.0_rc1-x86_64.tar.gz
```

Now we are going to made some updates to our code.

```cpp
createChild([](void *args) -> int {
      cout << "current process id: " << getpid() << endl;
      string hostname = "my-container";

      clearenv();
      chroot("./root"); //point to your downloaded base folder.
      chdir("/"); // point to root folder /.

      sethostname(hostname.c_str(), hostname.size());
      run("/bin/sh");

  }, CLONE_NEWUTS | CLONE_NEWPID | SIGCHLD);
```

Now run your program and if everything is fine, you will see our child process (```/bin/sh```) is totally constrained inside your new root folder, from its point of view is like living in other dimension.

Let's explain what happened:

 ```cpp
chroot("./root");
chdir("/");
 ```

This basically change the root folder of our child process from our system ```/``` folder to an arbitrary folder in this case ``` root ``` folder we created above. Then we jump to it ```chdir```. Can we choose an empty folder? Yes, but the problem is that our bash won't have any binaries like (ls, cd, ps) it would be impossible to scan our container, but also there is a nice lesson to learn here, we can use this fact to contain processes that can work by their own.


#### Mounting Filesystem into our container

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

      run("/bin/sh");
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
