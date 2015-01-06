// use this transport for "binary" data type
$.ajaxTransport("+binary", function(options, originalOptions, jqXHR){
    // check for conditions and support for blob / arraybuffer response type
    if (window.FormData && ((options.dataType && (options.dataType == 'binary')) || (options.data && ((window.ArrayBuffer && options.data instanceof ArrayBuffer) || (window.Blob && options.data instanceof Blob)))))
    {
        return {
            // create new XMLHttpRequest
            send: function(_, callback){
                // setup all variables
                var xhr = new XMLHttpRequest(),
                    url = options.url,
                    type = options.type,
                    // blob or arraybuffer. Default is blob
                    dataType = options.responseType || "blob",
                    data = options.data || null;
                
                xhr.addEventListener('load', function(){
                    var data = {};
                    data[options.dataType] = xhr.response;
                    // make callback and send data
                    callback(xhr.status, xhr.statusText, data, xhr.getAllResponseHeaders());
                });

                xhr.open(type, url, true);
                xhr.responseType = dataType;
                xhr.send(data);
            },
            abort: function(){
                jqXHR.abort();
            }
        };
    }
});

(function() {
    var resourceCache = [];

    function loadBinary(url, name) {

        return $.ajax({
          url: url,
          type: "GET",
          dataType: 'binary',
          responseType:'arraybuffer',
          processData: false,
          
          success: function(result){                  
              // create unsigned Int array and convert this array into blob
              var arrayBufferView = new Uint8Array(result );
              console.log("Resource loaded: " + url);
              resourceCache[name] = arrayBufferView;
              return arrayBufferView;
          }
        });
    }

    function get(name) {
        return resourceCache[name];
    }

    window.resources = {
        loadBinary: loadBinary,
        get: get
    };
})();