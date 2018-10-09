if (typeof define !== 'function') { var define = require('amdefine')(module) }
define( function(require,exports,module){

    /*

     #MenuView

     A list of available actions, given the current context.

     ## References
     * Sheet
     * SelectionCollection

     */

    var $ = require('jquery');
    var t = require('../templates');
    var RefBinder = require('ref-binder');
    var View = require('backbone').View;
    var ExpressionHelpers = require('../lib/expression_helpers');
    var _ = require('underscore');

    var _jsDataChecker = require('jsdatacheckermodule');

    var QualityCheckerMenuView = module.exports = View.extend({

        events: {
            'click .es-button': 'onRunQualitycheckerClick',
            'click #prev_issue': 'onPrevIssueClick',
            'click #next_issue': 'onNextIssueClick',
        },

        initialize: function(o){
            this.models = new RefBinder(this);
            this.data = o.data;
            this.$el = o.el;
            this.table_function_menu = o.table_function_menu;

            this.setSheets(o.data.sheets || null);
            this.setUser(o.data.users.getCurrentUser());
            var current_sheet_id = this.getUser().getCurrentSheetId();
            this.setSheet(o.data.sheets.get(current_sheet_id) || null);
            this.setSelection(o.data.selections.getLocal() || null);

            //This is an object that stores the a pointer to the current cell
            //on the sheet plus additional info.
            this.warningPointer = { pointer: -1, label: '', message: '', cells: [] };
        },

        getSelection: function(){
            return this.models.get('selection');
        },

        setSelection: function(selection){
            this.models.set('selection',selection);
        },

        getSheet: function(){
            return this.models.get('sheet');
        },

        setSheet: function(sheet){
            this.models.set('sheet',sheet);
        },

        getSheets: function(){
            return this.models.get('sheets');
        },

        setSheets: function(sheets){
            this.models.set('sheets', sheets);
        },

        getUser: function(){
            return this.models.get('user');
        },

        setUser: function(user){
            this.models.set('user', user, {
                'change_current_sheet_id': 'onChangeCurrentSheetID',
            });
        },

        render: function(){
            var eh = ExpressionHelpers(this.data);
            this.$el.empty();
            this.$el.html(t.qualitychecker_menu({eh:eh}));
        },

        getCurrentCell: function(){
            var cells =this.getSelection().getCells();
            if(!cells) return;
            return cells[0];
        },

        _findInsertionPlace: function (cells, rowIndex) {
            var index = 0;
            for (cell=null; index<cells.length && (cell=cells[index]); index++) {
                if (cell.rowIndex > rowIndex) return index;
            }

            return index;
        },//EndFunction.

        onRunQualitycheckerClick: function(e) {
            $('#spiQualitychecker').show();
            $('#panelQualitychecker').hide();

            var current_sheet_id = this.getUser().getCurrentSheetId();
            var jsonDataset = this._generateJSONFromSheet(current_sheet_id);
            var current_sheet = this.getSheets().get(current_sheet_id);

            var _converter =  _jsDataChecker();

            //Checks the dataset quality.
            var path = [ "records", "*" ]
            var analysisResults =  _converter.inferJsonDataType(jsonDataset, path,
                { filterOnThresholdConfidence: false, trackCellsForEachType: true});

            //Initialize the pointer object.
            $('.warning').removeClass('warning');
            this.warningPointer.pointer = -1;
            this.warningPointer.cells = [];
            const _keys = Object.keys(analysisResults.types);
            for (var iKey=0; iKey<_keys.length; iKey++) { //Loop through columns (types).
                var _type = analysisResults.types[_keys[iKey]];//Get column type.
                if (typeof _type.cellsWithWarnings === 'undefined' || _type.cellsWithWarnings.length == 0) continue; //No warnings.

                //There are cells with warnings, collect them in a huge array to be used.
                for (var _iCell=0; _iCell<_type.cellsWithWarnings.length; _iCell++) {
                    var _wrongCell = _type.cellsWithWarnings[_iCell];
                    var _wrongColKey = _wrongCell.columnKey;
                    var _wrongRowKey = current_sheet.allRows[(_wrongCell.rowIndex+1)];
                    _wrongCell.rowKey = _wrongRowKey;
                    _wrongCell.jqSelector = "td[data-row_id='" + _wrongRowKey + "'][data-col_id='" + _wrongColKey + "']";

                    //Here it inserts the item in the array, ordered by rowIndex using the insertion sort.
                    var insertionIndex = this._findInsertionPlace(this.warningPointer.cells, _wrongCell.rowIndex);
                    this.warningPointer.cells.splice(insertionIndex, 0, _wrongCell);
                }//EndFor.
            }//EndFor.

            //////////////////////////////////////////////
            //Activates the next and prev issues buttons.
            if (this.warningPointer.cells.length > 0) {
                this.warningPointer.pointer = -1;
                $('#prev_issue').addClass("search_arrows_enabled");
                $('#next_issue').addClass("search_arrows_enabled");
                this.warningPointer.label = "Warning 1 of " + this.warningPointer.cells.length;
                $('#txtQualityIssues').text(this.warningPointer.label);
                $('#panelQualitychecker').fadeIn();
                $('#txtMessage').hide();
            } else {
                this.warningPointer.pointer = -1;
                $('#prev_issue').removeClass("search_arrows_enabled");
                $('#next_issue').removeClass("search_arrows_enabled");
                this.warningPointer.label = "";
                $('#txtQualityIssues').text(this.warningPointer.label);
                $('#panelQualitychecker').hide();
                $('#txtMessage').show();
            }
            this.onNextIssueClick();

            $('#spiQualitychecker').hide();

            //Show the dialog to select the cell.
            //$('#es-modal-box').html(t.checkdataset_dialog({errors_list: errorsList, noErrorsMessage:  noErrorsMessage, errorMessageTitle: errorMessageTitle}));
            //$('#es-modal-overlay').show();
        },

        onPrevIssueClick: function(e) {
            if (this.warningPointer.cells.length == 0) return; //No issues.

            if (this.warningPointer.pointer == 0) this.warningPointer.pointer = this.warningPointer.cells.length - 1;
            else this.warningPointer.pointer = ((this.warningPointer.pointer-1) % this.warningPointer.cells.length);
            this.onNextPrevIssueClick(e);
        },

        onNextIssueClick: function(e) {
            if (this.warningPointer.cells.length == 0) return; //No issues.

            this.warningPointer.pointer = ((this.warningPointer.pointer+1) % this.warningPointer.cells.length);

            this.onNextPrevIssueClick(e);
        },

        onNextPrevIssueClick: function (e) {
            const _cell = this.warningPointer.cells[this.warningPointer.pointer];
            this.table_function_menu.pageSelection(this.table_function_menu.getPageForRow(_cell.rowKey));
            this.table_function_menu.scrollTo2($(_cell.jqSelector));

            this.warningPointer.label = "Warning " + (this.warningPointer.pointer+1) + " of " + this.warningPointer.cells.length;
            $('#txtQualityIssues').text(this.warningPointer.label);

            $('#issue_description').text((_cell.warningMessage !== 'undefined')? _cell.warningMessage : '-');

            $(".warning").removeClass("warning");
            //$("td").removeClass("warning");
            //$(_cell.jqSelector).addClass("warning");

            setTimeout(function() { $(_cell.jqSelector).addClass("warning"); }, 200);
        },

        _generateJSONFromSheet: function (sheet_id) {
            var sheet = this.getSheets().get(sheet_id);

            //This piece of code, converts the sheet in CKAN compliant format.
            var records = [];
            var _rows = sheet.allRows;

            //Creates a data structure from the ethersheet.
            //It uses only the first row in this case.
            var fields = [];
            var es_header = sheet.cells[_rows[0]];
            if (typeof es_header === 'undefined') return { fields: fields, records: records };

            for (var i=0; i<sheet.cols.length; i++) {
                var es_col_key = sheet.cols[i];
                var es_cell = es_header[es_col_key];
                if (typeof es_cell !== 'undefined') {
                    var name = es_col_key;
                    var field = { name: name, label: es_cell.value, index: i, key: name };
                    fields.push(field);
                    fields[name] = field;

                    /* USES A GENERATED NAME.
                     var name = es_cell.value.replace(/\s/, "_");
                     var field = { name: name, label: es_cell.value, index: i, key: es_col_key };
                     fields.push(field);
                     fields[name];*/
                }//EndIf.
            }//EndFor.

            //Loops over the rows.
            for (var ir=1; ir<_rows.length; ir++) {
                var es_row_key = _rows[ir];
                var es_row = sheet.cells[es_row_key];
                var jsonRow = {};

                //Check whether the row is null.
                if (typeof es_row === 'undefined') continue;

                //Loops over the cols.
                for (var ic=0; ic<fields.length; ic++) {
                    var colkey = fields[ic].key;
                    if (es_row.hasOwnProperty(colkey)) {
                        var es_cell = es_row[colkey];
                        if (typeof es_cell !== 'undefined' && es_cell != null)
                            jsonRow[colkey] = es_cell.value;
                    }
                }//EndForCol.

                records.push(jsonRow);
            }//EndFor.

            var jsonDataset = { fields: fields, records: records };
            return jsonDataset;
        },




    });

});
