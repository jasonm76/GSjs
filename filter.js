var yb   =  [ 0.00010501,  0.00042004,  0.00063006,  0.00042004,  0.00010501];
var ya   =  [ 1.00000000, -3.33787709,  4.20480923, -2.36821297,  0.50296098];
var y_zi =  [ 0.99989499, -2.33840213,  1.86577704, -0.50285597,  0.00000000];

var cb   =  [ 0.70911985, -2.83647938,  4.25471907, -2.83647938,  0.70911985];
var ca   =  [ 1.00000000, -3.3302056 ,  4.17977946, -2.34191808,  0.49401438];
var c_zi =  [-0.70911985,  2.12735954, -2.12735954,  0.70911985,  0.00000000];

var ib   =  [ 0.00605349,  0.01210697,  0.00605349];
var ia   =  [ 1.00000000, -1.76816293,  0.79237688];
var i_zi =  [ 0.99394651, -0.78632339,  0.00000000];

var qb   =  [ 0.00278987,  0.00557974,  0.00278987];
var qa   =  [ 1.00000000, -1.84512919,  0.85628867];
var q_zi =  [ 0.99721013, -0.85349880,  0.00000000];

function add_index_range(indices, beg, end)
{
    for (var i = beg; i <= end; ++i)
        indices.push(i);
    return indices;
}

function add_index_const(indices, value, numel)
{
    while (numel--)
        indices.push(value);
    return indices;
}

function subvector_reverse(vec, idx_end, idx_start)
{
    return vec.slice(idx_start, idx_end+1).reverse();
}

inline int max_val(const vectori& vec)
{
    return std::max_element(vec.begin(), vec.end())[0];
}

function filtfilt(B, A, X, zi)
{
    var len = X.length;     // length of input
    var na = A.length;
    var nb = B.length;
    var nfilt = (nb > na) ? nb : na; 
    var nfact = 3 * (nfilt - 1); // length of edge transients

    if (len <= nfact) {
        console.log("Input data too short! Data must have length more than 3 times filter order.");
        return X;
    }

    // set up filter's initial conditions to remove DC offset problems at the
    // beginning and end of the sequence

    var rows, cols;
    //rows = [1:nfilt-1           2:nfilt-1             1:nfilt-2];
    rows = add_index_range([], 0, nfilt - 2);
    if (nfilt > 2)
    {
        rows = add_index_range(rows, 1, nfilt - 2);
        rows = add_index_range(rows, 0, nfilt - 3);
    }
    //cols = [ones(1,nfilt-1)         2:nfilt-1          2:nfilt-1];
    cols = add_index_const([], 0, nfilt - 1);
    if (nfilt > 2)
    {       
        cols = add_index_range(cols, 1, nfilt - 2);
        cols = add_index_range(cols, 1, nfilt - 2);
    }
    // data = [1+a(2)         a(3:nfilt)        ones(1,nfilt-2)    -ones(1,nfilt-2)];

    var klen = rows.length;
    var data = new Array(klen);

    data[0] = 1 + A[1];  var i, j = 1;
    if (nfilt > 2)
    {
        for (i = 2; i < nfilt; i++)
            data[j++] = A[i];
        for (i = 0; i < nfilt - 2; i++)
            data[j++] = 1.0;
        for (i = 0; i < nfilt - 2; i++)
            data[j++] = -1.0;
    }

    var leftpad = subvector_reverse(X, nfact, 1);
    var _2x0 = 2 * X[0];
    for (i = 0; i < leftpad.length; ++i) {leftpad[i] = _2x0 - leftpad[i];}

    var rightpad = subvector_reverse(X, len - 2, len - nfact - 1);
    var _2xl = 2 * X[len-1];
    for (i = 0; i < rightpad.length; ++i) {rightpad[i] = _2xl - rightpad[i];}

    var y0;

    var signal1 = leftpad.concat(X, rightpad);

    // Do the forward and backward filtering
    y0 = signal1[0];
    zzi = zi.slice(0);  // clone the array;
    for (i = 0; i < zzi.length - 1; ++i) {zzi[i] = y0 * zzi[i];}
    var signal2 = filter(B, A, signal1, zzi).reverse();
    zzi = zi.slice(0);  
    y0 = signal2[0];
    for (i = 0; i < zzi.length - 1; ++i) {zzi[i] = y0 * zzi[i];}
    signal1 = filter(B, A, signal2, zzi);

    return subvector_reverse(signal1, signal1.length - nfact - 1, nfact);
}

function filter(B, A, X, zi)
{

    var input_size = X.length;
    var filter_order = A.length
     
    // Initialize Y, the return variable
    var Y = new Array(input_size);
    for (var i = 0; i < input_size; ++i) {Y[i] = 0.0;}

    for (i = 0; i < input_size; ++i) {
        var order = filter_order - 1;
        while(order) {
            if (i >= order) {
                zi[order - 1] = B[order] * X[i - order] - A[order] * Y[i - order] + zi[order];
            }
            --order;
        }
        Y[i] = B[0] * X[i] + zi[0];
    }

    return Y;
}
