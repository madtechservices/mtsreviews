(function (mw) {

    mw.dialog = function (options) {
        return new mw.Dialog(options);
    };

    mw.dialogIframe = function (options, cres) {
        options.pauseInit = true;
        var attr = 'frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen';
        if (options.autoHeight) {
            // attr += ' scrolling="no"';
            options.height = 'auto';
        }
        options.content = '<iframe src="' + mw.external_tool(options.url.trim()) + '" ' + attr + '><iframe>';
        options.className = ('mw-dialog-iframe mw-dialog-iframe-loading ' + (options.className || '')).trim();
        options.className += (options.autoHeight ? ' mw-dialog-iframe-autoheight' : '');
        var dialog = new mw.Dialog(options, cres);
        dialog.iframe = dialog.dialogContainer.querySelector('iframe');
        mw.tools.loading(dialog.dialogContainer, 90);
        dialog.dialogContainer.style.minHeight = '100px';
        mw.spinner({element: dialog.dialogContainer, size: 32, decorate: true}).show();





        var maxHeight = 'calc(100vh - 140px)';


        setTimeout(function () {
            var frame = dialog.dialogContainer.querySelector('iframe');
            frame.style.minHeight = 0; // reset in case of conflicts
            frame.loading = 'lazy';

            if (options.autoHeight) {
                mw.tools.iframeAutoHeight(frame, {dialog: dialog, maxHeightWindowScroll: maxHeight});
            } else{
                $(frame).height(options.height - 60);
                frame.style.position = 'relative';
                frame.style.maxHeight = maxHeight;
            }
            mw.$(frame).on('load', function () {
                mw.tools.loading(dialog.dialogContainer, false);
                mw.spinner({element: dialog.dialogContainer, size: 32, decorate: true}).remove();
                setTimeout(function () {
                    dialog.center();
                    mw.$(frame).on('bodyResize', function () {
                        dialog.center();
                    });
                    dialog.dialogMain.classList.remove('mw-dialog-iframe-loading');

                    if(frame && frame.contentWindow && frame.contentWindow.thismodal) {
                        frame.contentWindow.thismodal = dialog;
                        if (options.autoHeight) {
                            mw.tools.iframeAutoHeight(frame, {dialog: dialog, maxHeightWindowScroll: maxHeight});
                        }
                    }
                }, 78);
                if (mw.tools.canAccessIFrame(frame)) {
                    mw.$(frame.contentWindow.document).on('keydown', function (e) {
                        if (mw.event.is.escape(e) && !mw.event.targetIsField(e)) {
                            if(mw.top().__dialogs && mw.top().__dialogs.length){
                                var dlg = mw.top().__dialogs;
                                dlg[dlg.length - 1]._doCloseButton();
                                $(dlg[dlg.length - 1]).trigger('closedByUser');
                            }
                            else {
                                if (dialog.options.closeOnEscape) {
                                    dialog._doCloseButton();
                                    $(dialog).trigger('closedByUser');
                                }
                            }
                        }
                    });
                }
                if(typeof options.onload === 'function') {
                    options.onload.call(dialog);
                }
            });
        }, 12);
        return dialog;
    };

    /** @deprecated */
    mw.modal = mw.dialog;
    mw.modalFrame = mw.dialogIframe;

    mw.dialog.remove = function (selector) {
        var dlg = mw.dialog.get(selector);
        if(dlg) {
            dlg.remove()
        }
    };

    mw.dialog.get = function (selector) {
        selector = selector || '.mw-dialog';
        var $el = mw.$(selector);
        var el = $el[0];

        if(!el) return false;

        if(el._dialog) {
            return el._dialog;
        }
        var child_cont = el.querySelector('.mw-dialog-holder');
        var parent_cont = $el.parents(".mw-dialog-holder:first");
        if (child_cont) {
            return child_cont._dialog;
        }
        else if (parent_cont.length !== 0) {
            return parent_cont[0]._dialog;
        }
        else if (window.thismodal) {
            return thismodal;
        }
        else {
             // deprecated
            child_cont = el.querySelector('.mw_modal');
            parent_cont = $el.parents(".mw_modal:first");
            if(child_cont) {
                return child_cont.modal;
            } else if (parent_cont.length !== 0) {
                return parent_cont[0].modal;
            }
            return false;
        }
    };


    mw.Dialog = function (options, cres) {

        var scope = this;

        options = options || {};
        options.content = options.content || options.html || '';

        if(!options.height && typeof options.autoHeight === 'undefined') {
            options.height = 'auto';
            options.autoHeight = true;
        }

        var defaults = {
            skin: 'default',
            overlay: true,
            overlayClose: false,
            autoCenter: true,
            root: document,
            id: options.name || options.id || mw.id('mw-dialog-'),
            content: '',
            closeOnEscape: true,
            closeButton: true,
            closeButtonAppendTo: '.mw-dialog-header',
            closeButtonAction: 'remove', // 'remove' | 'hide'
            draggable: true,
            scrollMode: 'inside', // 'inside' | 'window',
            centerMode: 'intuitive', // 'intuitive' | 'center'
            containment: 'window',
            overflowMode: 'auto', // 'auto' | 'hidden' | 'visible'
            disableTextSelection: false,

        };

        this.options = $.extend({}, defaults, options, {
            // skin: 'default'
        });

        this.id = this.options.id;


        var exist = document.getElementById(this.id);
        if (exist) {
            return exist._dialog;
        }

        this.hasBeenCreated = function () {
            return this.options.root.getElementById(this.id) !== null;
        };

        if (this.hasBeenCreated()) {
            return this.options.root.getElementById(this.id)._dialog;
        }

        if(!mw.top().__dialogs ) {
            mw.top().__dialogs = [];
        }
        if (!mw.top().__dialogsData) {
            mw.top().__dialogsData = {};
        }


        if (!mw.top().__dialogsData._esc) {
            mw.top().__dialogsData._esc = true;
            mw.$(document).on('keydown', function (e) {
                if (mw.event.is.escape(e)) {
                    var dlg = mw.top().__dialogs[mw.top().__dialogs.length - 1];
                    if (dlg && dlg.options && dlg.options.closeOnEscape) {
                        dlg._doCloseButton();
                    }
                }
            });
        }

        mw.top().__dialogs.push(this);

        this.draggable = function () {
            if (this.options.draggable && $.fn.draggable) {
                var $holder = mw.$(this.dialogHolder);
                $holder.draggable({
                    handle: this.options.draggableHandle || '.mw-dialog-header',
                    start: function () {
                        $holder.addClass('mw-dialog-drag-start');
                        scope._dragged = true;
                    },
                    stop: function () {
                        $holder.removeClass('mw-dialog-drag-start');
                    },
                    containment: scope.options.containment,
                    scroll: false,
                    iframeFix: true
                });
            }
        };

        this.header = function () {
            this.dialogHeader = this.options.root.createElement('div');
            this.dialogHeader.className = 'mw-dialog-header';
            if (this.options.title || this.options.header) {
                this.dialogHeader.innerHTML = '<div class="modal-title settings-title-inside">' + (this.options.title || this.options.header) + '</div>';
            }
        };

        this.footer = function (content) {
            this.dialogFooter = this.options.root.createElement('div');
            this.dialogFooter.className = 'mw-dialog-footer';
            if (this.options.footer) {
                $(this.dialogFooter).append(this.options.footer);
            }
        };

        this.title = function (title) {
            var root = mw.$('.mw-dialog-title', this.dialogHeader);
            if (typeof title === 'undefined') {
                return root.html();
            } else {
                if (root[0]) {
                    root.html(title);
                }
                else {
                    mw.$(this.dialogHeader).prepend('<div class="modal-title settings-title-inside">' + title + '</div>');                }
            }
        };


        this.build = function () {
            this.dialogMain = this.options.root.createElement('div');
            if (this.options.disableTextSelection){
                this.dialogMain.style.userSelect = 'none';
            }
            this.dialogMain.id = this.id;
            var cls = 'mw-dialog mw-dialog-scroll-mode-' + this.options.scrollMode
                + ' mw-dialog-skin-' + this.options.skin
                + ' mw-dialog-overflowMode-' + this.options.overflowMode;
            cls += (!this.options.className ? '' : (' ' + this.options.className));
            this.dialogMain.className = cls;
            this.dialogMain._dialog = this;

            this.dialogHolder = this.options.root.createElement('div');
            this.dialogHolder.id = 'mw-dialog-holder-' + this.id;


            this.dialogHolder._dialog = this;

            this.header();
            this.footer();
            this.draggable();



            this.dialogContainer = this.options.root.createElement('div');
            this.dialogContainer._dialog = this;

            // TODO: obsolate
            this.container = this.dialogContainer;


            this.dialogContainer.className = 'mw-dialog-container';
            this.dialogHolder.className = 'mw-dialog-holder';

            var cont = this.options.content;
            if(this.options.shadow) {
                this.shadow = this.dialogContainer.attachShadow({
                    mode: 'open'
                });
                if(typeof cont === 'string') {
                    this.shadow.innerHTML = (cont);
                } else {
                    this.shadow.appendChild(cont);
                }
            } else {
                mw.$(this.dialogContainer).append(cont);
            }


            if (this.options.encapsulate) {
                this.iframe = cont;
                this.iframe.style.display = '';
            }

            this.dialogHolder.appendChild(this.dialogHeader);
            this.dialogHolder.appendChild(this.dialogContainer);
            this.dialogHolder.appendChild(this.dialogFooter);

            this.closeButton = this.options.root.createElement('div');
            this.closeButton.className = 'mw-dialog-close';

            this.closeButton.$scope = this;

            this.closeButton.onclick = function (e) {
                e.preventDefault();
                this.$scope[this.$scope.options.closeButtonAction]();
                $(this.$scope).trigger('closedByUser');
            };
            this.main = mw.$(this.dialogContainer); // obsolete
            this.main.width = this.width;

            this.width(this.options.width || 600);
            this.height(this.options.height || 320);

            this.options.root.body.appendChild(this.dialogMain);
            this.dialogMain.appendChild(this.dialogHolder);
            if (this.options.closeButtonAppendTo) {
                mw.$(this.options.closeButtonAppendTo, this.dialogMain).append(this.closeButton)
            }
            else {
                this.dialogHolder.appendChild(this.closeButton);

            }

            this.dialogOverlay();
            return this;
        };

        this._doCloseButton = function() {
            this[this.options.closeButtonAction]();
        };

        this.containmentManage = function () {
            if (scope.options.containment === 'window') {
                if (scope.options.scrollMode === 'inside') {
                    var rect = this.dialogHolder.getBoundingClientRect();
                    var $win = mw.$(window);
                    var sctop = $win.scrollTop();
                    var height = $win.height();
                    if (rect.top < sctop || (sctop + height) > (rect.top + rect.height)) {
                        this.center();
                    }
                }
            }
        };

        this.dialogOverlay = function () {
            this.overlay = this.options.root.createElement('div');
            this.overlay.className = 'mw-dialog-overlay';
            this.overlay.$scope = this;
            if (this.options.overlay === true || typeof this.options.overlay === 'string') {
                this.dialogMain.appendChild(this.overlay);
                if( typeof this.options.overlay === 'string' ) {
                    this.overlay.style.backgroundColor = this.options.overlay;
                }

            }
            mw.$(this.overlay).on('click', function () {
                if (this.$scope.options.overlayClose === true) {
                    this.$scope._doCloseButton();
                    $(this.$scope).trigger('closedByUser');
                }
            });
            return this;
        };

        this._afterSize = function() {
            if(mw._iframeDetector) {
                mw._iframeDetector.pause = true;
                var frame = window.frameElement;
                if(frame && parent !== top){
                    var height = this.dialogContainer.scrollHeight + this.dialogHeader.scrollHeight;
                    if($(frame).height() < height) {
                        frame.style.height = ((height + 100) - this.dialogHeader.offsetHeight - this.dialogFooter.offsetHeight) + 'px';
                        if(window.thismodal){
                            thismodal.height(height + 100);
                        }

                    }
                }
            }
        };

        this.show = function () {
            mw.$(this.dialogMain).find('iframe').each(function(){
                this._intPause = false;
            });
            mw.$(this.dialogMain).addClass('active');
            this.center();
            this._afterSize();
            mw.$(this).trigger('Show');
            mw.trigger('mwDialogShow', this);
            return this;
        };

        this._hideStart = false;
        this.hide = function () {
            if (!this._hideStart) {
                this._hideStart = true;
                mw.$(this.dialogMain).find('iframe').each(function(){
                    this._intPause = true;
                });
                setTimeout(function () {
                    scope._hideStart = false;
                }, 300);
                mw.$(this.dialogMain).removeClass('active');
                if(mw._iframeDetector) {
                    mw._iframeDetector.pause = false;
                }
                mw.$(this).trigger('Hide');
                mw.trigger('mwDialogHide', this);
            }
            return this;
        };

        this.forceRemove = function () {
            mw.$(this.dialogMain).remove();
            for (var i = 0; i < mw.top().__dialogs.length; i++) {
                if (mw.top().__dialogs[i] === this) {
                    mw.top().__dialogs.splice(i, 1);
                    break;
                }
            }
            clearInterval(this._observe.interval);
            return this;
        }
        this.remove = function () {

            mw.$(this).trigger('BeforeRemove');
            if (typeof this.options.beforeRemove === 'function') {
                if(this.options.beforeRemove(this) === false) {
                    return;
                }
            }

            this.hide();
            mw.removeInterval('iframe-' + this.id);

            if(this.options.onremove) {
                this.options.onremove()
            }
            mw.$(this).trigger('Remove');
            mw.trigger('mwDialogRemove', this);

            this.forceRemove()
        };

        this.destroy = this.remove;

        this._prevHeight = -1;
        this._dragged = false;

        this.center = function (width, height) {
            var $holder = mw.$(this.dialogHolder), $window = mw.$(window);
            var holderHeight = height || $holder.outerHeight();
            var holderWidth = width || $holder.outerWidth();
            var dtop, css = {};

            if (this.options.centerMode === 'intuitive' && this._prevHeight < holderHeight) {
                dtop = $window.height() / 2 - holderHeight / 2;
            } else if (this.options.centerMode === 'center') {
                dtop = $window.height() / 2 - holderHeight / 2;
            }

            if (!scope._dragged) {
                css.left = $window.outerWidth() / 2 - holderWidth / 2;
            } else {
                css.left = parseFloat($holder.css('left'));
            }

            if(css.left + holderWidth > $window.width()){
                css.left = css.left - ((css.left + holderWidth) - $window.width());
            }

            if (dtop) {
                css.top = dtop > 0 ? dtop : 0;
            }



            /*if(window !== mw.top().win && document.body.scrollHeight > mw.top().win.innerHeight){
                $win = $(mw.top());

                css.top = $(document).scrollTop() + 50;
                var off = $(window.frameElement).offset();
                if(off.top < 0) {
                    css.top += Math.abs(off.top);
                }
                if(window.thismodal) {
                    css.top += thismodal.dialogContainer.scrollTop;
                }

            }*/


            $holder.css(css);
            this._prevHeight = holderHeight;


            this._afterSize();
            mw.$(this).trigger('dialogCenter');

            return this;
        };

        this.width = function (width) {
            if(!width) {
                return mw.$(this.dialogHolder).outerWidth();
            }
            mw.$(this.dialogHolder).width(width);
            this._afterSize();
        };
        this.height = function (height) {
            if(!height) {
                return mw.$(this.dialogHolder).outerHeight();
            }
            mw.$(this.dialogHolder).height(height);
            this._afterSize();
        };
        this.resize = function (width, height) {
            if (typeof width !== 'undefined') {
                this.width(width);
            }
            if (typeof height !== 'undefined') {
                this.height(height);
            }
            this.center(width, height);
        };
        this.content = function (content) {
            this.options.content = content || '';
            $(this.dialogContainer).empty().append(this.options.content);
            return this;
        };

        this.result = function(result, doClose) {
            this.value = result;
            if(this.options.onResult){
                this.options.onResult.call( this, result );
            }
            if (cres) {
                cres.call( this, result );
            }
            $(this).trigger('Result', [result]);
            if(doClose){
                this._doCloseButton();
            }
        };


        this.contentMaxHeight = function () {
            var scope = this;
            if (this.options.scrollMode === 'inside') {
                mw.interval('iframe-' + this.id, function () {
                    var max = mw.$(window).height() - scope.dialogHeader.clientHeight - scope.dialogFooter.clientHeight - 40;
                    scope.dialogContainer.style.maxHeight = max + 'px';
                    scope.dialogContainer.style.maxHeight = 'calc(100vh - 100px)';
                    scope.containmentManage();
                });
            }
        };

        this._observe = {};
        this.observeDimensions = function(cb) {
            if (!this._observe.interval) {
                var changed = function () {
                  var css = getComputedStyle(scope.dialogMain);
                  if (!scope._observe.data) {
                      scope._observe.data = {
                          width: css.width,
                          height: css.height
                      };
                      return {
                          width: css.width,
                          height: css.height
                      };
                  } else  {
                      var curr = scope._observe.data;
                      // if(curr.width !== css.width || curr.height !== css.height) {
                          scope._observe.data = {
                              width: css.width,
                              height: css.height
                          };
                          return {
                              width: css.width,
                              height: css.height
                          };
                      // }
                  }
                };
                this._observe.interval = setInterval(function (){
                    var chg = changed();
                    if (chg) {
                        cb.call(scope, chg);
                    }

                }, 333);
            }
        };

        this.position = function (x, y) {
            if(!x) {
                return;
            }
            scope._dragged = true;
            if(typeof x === 'object') {
                y = x.y;
                x = x.x;
            }

            if(typeof y === 'undefined') {
                y = x
            }

            if(typeof x === 'number') {
                x += 'px';

            }

            if(typeof y === 'number') {
                y += 'px';
            }

            this.dialogHolder.style.left = x;
            this.dialogHolder.style.top = y;

            return this;
        }

        this.positionToElement = function(targetElementSelector) {
            if(!targetElementSelector){
                return;
            }


            var node = $(targetElementSelector)[0];
            var nodeWindow = node.ownerDocument.defaultView;

            let off = mw.element(node).offset();
            if(nodeWindow.frameElement) {
                var winframe = mw.top().element(nodeWindow.frameElement).offset();
                off.offsetTop += winframe.offsetTop
                off.offsetLeft += winframe.offsetLeft
            }
            this.position(off.offsetLeft, off.offsetTop + off.height);
            setTimeout( ()=> {
                const colorPickerDialogOff = mw.element(this.dialogHolder).offset()
                if(colorPickerDialogOff.offsetTop + colorPickerDialogOff.height > mw.top().win.innerHeight) {
                    this.position(off.offsetLeft - colorPickerDialogOff.width, mw.top().win.innerHeight - colorPickerDialogOff.height);
                }
            }, 10);

        }

        this.calculateDialogPositionXY = function (element) {

            var position = {};
            if (self !== top) {
                position = this.getElementPositionInFrames(element);
            } else {
                position = this.getElementPositionOnScreen(element);
            }

            let newPositionX = position.x;
            let newPositionY = position.y;


            let elementBounding = element.getBoundingClientRect();
            let dialogBounding = this.dialogMain.getBoundingClientRect();

            let repositionDialog = this.positionDialogWithoutOverlap(this.dialogMain, element);
            if (repositionDialog) {
                newPositionX = repositionDialog.x;
                newPositionY = repositionDialog.y;
            }


            // newPositionX = (newPositionX + elementBounding.width) - 50;

            // if ((window.top.innerWidth - newPositionX) < (dialogBounding.width - 50)) {
            //     newPositionX = newPositionX - dialogBounding.width - (window.top.innerWidth - newPositionX);
            // }
            //
            // if ((window.top.innerHeight - newPositionY) < (dialogBounding.height - 50)) {
            //     newPositionY = newPositionY - dialogBounding.height + (window.top.innerHeight - newPositionY);
            // }

            if (newPositionX < 0) {
                newPositionX = 0;
            }

            if (newPositionY < 0) {
                newPositionY = 0;
            }

            console.log('innerWidth', elementBounding.width);
            console.log('innerHeight', elementBounding.height);

            console.log('newPositionX', newPositionX);
            console.log('newPositionY', newPositionY);

            this.options.position = {
                x: newPositionX,
                y: newPositionY
            };
            this.position(newPositionX, newPositionY);
        }

        this.positionDialogWithoutOverlap = function (dialogElement, targetElement) {
            var dialogRect = dialogElement.getBoundingClientRect();
            var targetRect = targetElement.getBoundingClientRect();

            var dialogWidth = dialogRect.width;
            var dialogHeight = dialogRect.height;

            var targetLeft = targetRect.left;
            var targetTop = targetRect.top;
            var targetWidth = targetRect.width;
            var targetHeight = targetRect.height;

            var currentWindow = window;

            while (currentWindow !== top) {
                var iframe = currentWindow.frameElement;
                var iframeRect = iframe.getBoundingClientRect();

                targetLeft += iframeRect.left;
                targetTop += iframeRect.top;

                currentWindow = currentWindow.parent;
            }

            var screenWidth = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
            var screenHeight = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;

            var spaceRight = screenWidth - targetLeft - targetWidth;
            var spaceBelow = screenHeight - targetTop - targetHeight;

            var dialogLeft, dialogTop;

            if (spaceRight >= dialogWidth) {
                dialogLeft = targetLeft + targetWidth;
                dialogTop = Math.max(targetTop + (targetHeight - dialogHeight) / 2, 0);
            } else if (spaceBelow >= dialogHeight) {
                dialogLeft = targetLeft + (targetWidth - dialogWidth) / 2;
                dialogTop = targetTop + targetHeight;
            } else {
                // Fallback position if there is not enough space on the right or below
                dialogLeft = targetLeft + targetWidth;
                dialogTop = Math.max(targetTop + (targetHeight - dialogHeight) / 2, 0);
            }

            return {
                x: dialogLeft,
                y: dialogTop
            }
        }

        this.getElementPositionInFrames = function (element) {
            var x = 0;
            var y = 0;
            var currentWindow = window;

            while (currentWindow !== top) {
                var iframe = currentWindow.frameElement;
                var iframeRect = iframe.getBoundingClientRect();
                var elementRect = element.getBoundingClientRect();

                x += iframeRect.left + elementRect.left;
                y += iframeRect.top + elementRect.top;

                currentWindow = currentWindow.parent;
            }

            return { x: x, y: y };
        }

        this.getElementPositionOnScreen = function(element) {
            var rect = element.getBoundingClientRect();

            var scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
            var scrollTop = window.pageYOffset || document.documentElement.scrollTop;

            var x = rect.left + scrollLeft;
            var y = rect.top + scrollTop;

            // Adjust position to stay within the visible screen area
            var screenWidth = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
            var screenHeight = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;

            x = Math.min(Math.max(x, 0), screenWidth - element.offsetWidth);
            y = Math.min(Math.max(y, 0), screenHeight - element.offsetHeight);

            return { x: x, y: y };
        }

        this.init = function () {
            this.build();
            this.contentMaxHeight();
            if(!this.options.position) {

                this.center();
            }

            this.show();
            if (this.options.autoCenter) {
                (function (scope) {
                    mw.$(window).on('resize orientationchange load', function () {
                        scope.contentMaxHeight();
                        scope.center();
                    });
                })(this);
            }
            if (!this.options.pauseInit) {
                mw.$(this).trigger('Init');
            }
            this.observeDimensions(function (){
                scope.center();
            });
            if(this.options.position) {
                this.position(this.options.position)
            }
            return this;
        };
        this.init();
    };

    mw.Dialog.elementIsInDialog = function (node) {
        return mw.tools.firstParentWithClass(node, 'mw-dialog');
    };

})(window.mw);


(function () {
    function scoped() {
        var all = document.querySelectorAll('style[scoped]'), i = 0;

        try {
            for( ; i < all.length; i++ ) {
                var parent = all[i].parentNode;
                parent.id = parent.id || mw.id('scoped-id-');
                var prefix = '#' + parent.id + ' ';
                var rules = all[i].sheet.rules;
                var r = 0;
                for ( ; r < rules.length; r++) {
                    var newRule = prefix + rules[r].cssText;
                    all[i].sheet.deleteRule(r);
                    all[i].sheet.insertRule(newRule, r);
                }
                all[i].removeAttribute('scoped');
            }
        }
        catch(error) {

        }


    }
    scoped();
    $(window).on('load', function () {
        scoped();
    });
})();


