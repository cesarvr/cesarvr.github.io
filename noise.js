var isPrime = function(num) {
    var iter = 0
    var show = function(iter, n) {
        console.log('iterations->', iter, ' divisor->', n, 'division->', num / n, '->num ', (num / n) * n);
    };
    var r = 0;
    for (r = 2; r < num; r++) {
        if ((num % r) === 0) {
            show(iter, r);
            return false;
        }
        iter++;
    }
    show(iter, r)
    return true;
}



var Noise = function() {};

Noise.prototype.distance = function(x, y) {
    return y - x;
};

Noise.prototype.smooth2d = function() {
    return n.noise(a) / 2 + n.noise(a - 1) / 4 + n.noise(a + 1) / 4;
};

Noise.prototype.hermineCurve = function(x) {
    return x * x * (3.0 - 2.0 * x);
};

var permutation = [
    151, 160, 137, 91, 90, 15,
    131, 13, 201, 95, 96, 53, 194, 233, 7, 225, 140, 36, 103, 30, 69, 142, 8, 99, 37, 240, 21, 10, 23,
    190, 6, 148, 247, 120, 234, 75, 0, 26, 197, 62, 94, 252, 219, 203, 117, 35, 11, 32, 57, 177, 33,
    88, 237, 149, 56, 87, 174, 20, 125, 136, 171, 168, 68, 175, 74, 165, 71, 134, 139, 48, 27, 166,
    77, 146, 158, 231, 83, 111, 229, 122, 60, 211, 133, 230, 220, 105, 92, 41, 55, 46, 245, 40, 244,
    102, 143, 54, 65, 25, 63, 161, 1, 216, 80, 73, 209, 76, 132, 187, 208, 89, 18, 169, 200, 196,
    135, 130, 116, 188, 159, 86, 164, 100, 109, 198, 173, 186, 3, 64, 52, 217, 226, 250, 124, 123,
    5, 202, 38, 147, 118, 126, 255, 82, 85, 212, 207, 206, 59, 227, 47, 16, 58, 17, 182, 189, 28, 42,
    223, 183, 170, 213, 119, 248, 152, 2, 44, 154, 163, 70, 221, 153, 101, 155, 167, 43, 172, 9,
    129, 22, 39, 253, 19, 98, 108, 110, 79, 113, 224, 232, 178, 185, 112, 104, 218, 246, 97, 228,
    251, 34, 242, 193, 238, 210, 144, 12, 191, 179, 162, 241, 81, 51, 145, 235, 249, 14, 239, 107,
    49, 192, 214, 31, 181, 199, 106, 157, 184, 84, 204, 176, 115, 121, 50, 45, 127, 4, 150, 254,
    138, 236, 205, 93, 222, 114, 67, 29, 24, 72, 243, 141, 128, 195, 78, 66, 215, 61, 156, 180
];

var p = [];

for (var i = 0; i < 256; i++) {
    p[256 + i] = p[i] = permutation[i];
}

console.log('permutations->', p.length);


/* 
  method: fade
  
  plug values to this function to get a smooth curve appareance. 
  f(t) = 6t^5 -15t^4 +10t^3

  
  http://www.wolframalpha.com/share/img?i=d41d8cd98f00b204e9800998ecf8427e9cfoailfv5&f=HBQTQYZYGY4TQNJQMI2DGZTDHAYDCNJQMQ4DQNZVMZSDOMBYHA3Qaaaa

*/

function fade(t) {
    return t * t * t * (t * (t * 6 - 15) + 10);
};

function test_fade = function() {
    for (var a = 0; a < 1.0; a += 0.01) {
        console.log('->', fade(a));
    };
};


/* 
  method: gradient

  dot product against pseudo-random vector 3D, candidates.

  (1,1,0),(-1,1,0),(1,-1,0),(-1,-1,0),
  (1,0,1),(-1,0,1),(1,0,-1),(-1,0,-1),
  (0,1,1),(0,-1,1),(0,1,-1),(0,-1,-1)

  return: 
    the dot product of args[x,y,z] * pseudo-random. 
  
  dot product is nothing more than component multiplication of each
  vector and the addition of the resulting vector. 

  https://en.wikipedia.org/wiki/Dot_product  

  the method return the implicit result of the operation.
*/
function gradient(int hash, double x, double y, double z)
{
    switch(hash & 0xF)
    {
        case 0x0: return  x + y;
        case 0x1: return -x + y;
        case 0x2: return  x - y;
        case 0x3: return -x - y;
        case 0x4: return  x + z;
        case 0x5: return -x + z;
        case 0x6: return  x - z;
        case 0x7: return -x - z;
        case 0x8: return  y + z;
        case 0x9: return -y + z;
        case 0xA: return  y - z;
        case 0xB: return -y - z;
        case 0xC: return  y + x;
        case 0xD: return -y + z;
        case 0xE: return  y - x;
        case 0xF: return -y - z;
        default: return 0; // never happens
    }
}



Noise.prototype.noise = function(x, y, z) {
    var iX, iY, iZ;

    var X = Math.floor(x) & 255, // FIND UNIT CUBE THAT
        Y = Math.floor(y) & 255, // CONTAINS POINT.
        Z = Math.floor(z) & 255;

    x -= Math.floor(x); // FIND RELATIVE X,Y,Z
    y -= Math.floor(y); // OF POINT IN CUBE.
    z -= Math.floor(z);


    console.log('(X Y Z) =>', '( ', X, ' ', Y, ' ', Z, ' )')
    console.log('(x y z) =>', '( ', x, ' ', y, ' ', z, ' )')

    var u = fade(x), 
        v = fade(y), 
        w = fade(z);

    console.log('(u v w) =>', '( ', u, ' ', v, ' ', w, ' )')

    var A  = p[X] + Y,
        AA = p[A] + Z,
        AB = p[A + 1] + Z,
        B  = p[X + 1] + Y,
        BA = p[B] + Z,
        BB = p[B + 1] + Z;


    console.log('A ->', A);
    console.log('AA ->', AA);
    console.log('AB ->', AB);
    console.log('B ->', B);
    console.log('BA ->', BA);
    console.log('BB ->', BB);




};

var perlin = new Noise();

perlin.noise(0.5, 2.3, 1.40);



//module.exports = new Noise();
