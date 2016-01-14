---
title:  "C++ Template"
date:   2016-01-XX 10:18:00
description: C++
---

My first template that generate at compile time fibunacci sequence, using recursive template calls. 

<pre>
<code class="javascript">

#include <iostream>

template<int N>
struct Fib {
    enum { value = Fib<N-1>::value + Fib<N-2>::value  };
};

template<>
struct Fib<0> {
    enum { value = 0 };
};

template<>
struct Fib<1> {
    enum { value = 1 };
};


int main(int argc, const char * argv[]) {
    // insert code here...
    std::cout << "Hello, World!\n";

    const int fib5 = Fib<6>::value;

    std::cout << "fib ->" << fib5  << std::endl;
    
    return 0;
}

</code>
</pre>


