if (typeof define !== 'function') { var define = require('amdefine')(module) }
define( function(require,exports,module){

    var $         = require('jquery');
    var t          = require('../templates');
    var RefBinder = require('ref-binder');
    var View      = require('backbone').View;
    var self;

    var UploadImageView = module.exports = View.extend({

        events: {
            'click #upload_image_button': 'uploadImage',
            'dragover #dragzone'        : 'onFileDrag',
            'dragleave #dragzone'       : 'onFileDragLeave',
            'drop #dragzone'            : 'onFileDrop',
            'change #image_file'        : 'fileSelected',
        },

        initialize: function(o) {
            this.models   = new RefBinder(this);
            this.cell     = o.cell;
            this.table    = o.table;
            self        = this;
        },


        render: function(){
            $('#es-modal-box').html(t.upload_image_dialog({sheet_id: this.table.getSheet().id}));
            $('#es-modal-overlay').show();
        },

        uploadImage: function(){
            $( '#upload_image_form' )
                .submit( function( e ) {
                    $.ajax( {
                        url: '/ethersheet/upload/image',
                        type: 'POST',
                        data: new FormData( this ),
                        processData: false,
                        contentType: false,
                        success : function(data) {
                            //udate cell value
                            self.cell.val(e.data);
                            self.table.getSheet().updateCell(self.cell.data('row_id'), self.cell.data('col_id'), data.image_url);
                            //dismiss dialog and menu
                            self.cell.on('mouseover', function(e){self.table.showCellPreview(e)});

                            $('#es-modal-overlay').hide();
                            $(".es-overlay").remove();
                        },
                        error : function(data){
                            alert(data.statusText + ": the file size must be less than 3Mb");
                            $('#es-modal-overlay').hide();
                            $(".es-overlay").remove();
                        }
                    } );
                    e.preventDefault();
                } );

        },

        onFileDrag: function(e){
            e.stopPropagation();
            e.preventDefault();
            $("#dragzone").addClass("ondrag");
        },

        onFileDragLeave : function(e){
            $("#dragzone").removeClass("ondrag");
        },

        onFileDrop: function(e){
            e.preventDefault();
            $("#dragzone").removeClass("ondrag");

            var files;
            if(_.isUndefined(e.dataTransfer))
               files = e.originalEvent.dataTransfer.files;
            else
               files = e.dataTransfer.files;
            $("#image_file")[0].files = files;
            this.showImagePreview(files[0]);

        },

        fileSelected : function(){
            this.showImagePreview($("#image_file")[0].files[0])
        },

        showImagePreview: function(img){
            $("#dragzone-caption").html("");
            if(!_.isUndefined(typeof FileReader)){
                var fs = new FileReader();
                fs.onload = function(e){
                    $("#dragzone").html('<img src="' + e.target.result  + '" />');
                };
                fs.readAsDataURL(img);
            }else{
                $("#dragzone-caption").html(files[0].name);
            }
        }


    })
});
