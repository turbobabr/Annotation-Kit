(function(){
    var root = this;

    var ShadowRemoverTool = {};

    var MetricsData = {
        contentScale: {
            "1": {
                activeWindow: {
                    left: 55,
                    top: 31,
                    right: 55,
                    bottom: 79
                },
                nonActiveWindow: {
                    left: 41,
                    top: 33,
                    right: 41,
                    bottom: 49
                },
                cornersRadius: 5
            },
            "2": {
                activeWindow: {
                    left: 110,
                    top: 62,
                    right: 110,
                    bottom: 158
                },
                nonActiveWindow: {
                    left: 82,
                    top: 66,
                    right: 82,
                    bottom: 98
                },
                cornersRadius: 10
            }
        },
        actualMetrics: function() {
            return this.contentScale[NSScreen.currentContentsScale().toString()];
        },
        universalMetrics: function() {
            return this.contentScale["1"];
        }
    };

    ShadowRemoverTool.validate = function(layer) {
        if(!layer) return null;
        if(!layer.isKindOfClass(MSBitmapLayer)) return null;

        var metric=MetricsData.actualMetrics();

        var imageRep=NSBitmapImageRep.imageRepWithData(layer.image().data());
        if(!imageRep) return null;

        // Check for existing alpha channel.
        if(!imageRep.hasAlpha()) {
            print("Shadow Remover Validation Failed: Has No Alpha!");
            return null;
        }

        var span = metric.cornersRadius*2;

        // Check for active window size.
        var frame = metric.activeWindow;
        if(imageRep.pixelsWide()<(frame.left+frame.right+span) || imageRep.pixelsHigh()<(frame.top+frame.bottom+span)) {
            print("Shadow Remover Validation Failed: Image too small to be a window screenshot!");
            return null;
        }

        // Check for non active window size.
        frame = metric.nonActiveWindow;
        if(imageRep.pixelsWide()<(frame.left+frame.right+span) || imageRep.pixelsHigh()<(frame.top+frame.bottom+span)) {
            print("Shadow Remover Validation Failed: Image too small to be a window screenshot!");
            return null;
        }

        // Test raster points.
        function testPixels(frame) {
            var sw=imageRep.pixelsWide();
            var sh=imageRep.pixelsHigh();

            function isShadow(x,y) {
                return { x: Math.round(x), y: Math.round(y), isBlack: true, isTransparent: true };
            }

            function isOpaque(x,y) {
                return { x: Math.round(x), y: Math.round(y), isTransparent: false };
            }

            var edgeSpan = 3;
            var probes=[
                // Test corners for black & transparent pixels.
                isShadow(0,0),
                isShadow(sw-1,0),
                isShadow(0,sh-1),
                isShadow(sw-1,sh-1),

                // Test corners for non-transparent pixels.
                isOpaque(frame.left+span,frame.top+span),
                isOpaque(sw-frame.right-span,frame.top+span),
                isOpaque(frame.left+span,sh-frame.bottom-span),
                isOpaque(sw-frame.right-span,sh-frame.bottom-span),

                // Left-Center edge.
                isShadow(frame.left-edgeSpan,sh/2),
                isOpaque(frame.left+edgeSpan,sh/2),

                // Right-Center edge.
                isShadow(sw-frame.right+edgeSpan,sh/2),
                isOpaque(sw-frame.right-edgeSpan,sh/2),

                // Bottom-Center edge.
                isShadow(sw/2,sh-frame.bottom+edgeSpan),
                isOpaque(sw/2,sh-frame.bottom-edgeSpan),

                // Top-Center edge.
                isShadow(sw/2,frame.top-edgeSpan),
                isOpaque(sw/2,frame.top+edgeSpan)
            ];

            function probePixel(p) {
                function isBlack(color) {
                    return color.redComponent()==0 && color.greenComponent()==0 && color.blueComponent()==0;
                }

                function isTransparent(color) {
                    return color.alphaComponent()!=1.0;
                }

                var color=[imageRep colorAtX:p.x y:p.y];
                if(!p.hasOwnProperty("isBlack")) {
                    return (isTransparent(color) == p.isTransparent);
                }

                return (isBlack(color) == p.isBlack) && (isTransparent(color) == p.isTransparent);
            }

            for(var i=0;i<probes.length;i++) {
                if(!probePixel(probes[i])) {
                    return false;
                }
            }

            return true;
        }

        // Test active window.
        if(testPixels(metric.activeWindow)) {
            return "activeWindow"
        }

        // Test non-active window
        if(testPixels(metric.nonActiveWindow)) {
            return "nonActiveWindow";
        }

        print("Shadow Remover Validation Failed: Image doesn't satisfy pixel probes!");

        return null;

    };

    ShadowRemoverTool.apply = function(layer,target) {
        var target = target || "activeWindow";
        this.removeShadow(layer,target);
    };

    ShadowRemoverTool.removeShadow = function(layer,target) {

        function cropRect(width,height) {
            var frame = MetricsData.universalMetrics()[target];
            return NSMakeRect(frame.left,frame.top,width-(frame.left+frame.right),height-(frame.top+frame.bottom));
        }

        var referenceLayerName=layer.name();
        var rect = cropRect(layer.frame().width(),layer.frame().height(),target);

        var rectShape = MSRectangleShape.alloc().init();
        rectShape.frame = MSRect.rectWithRect(NSMakeRect(layer.frame().x()+rect.origin.x,layer.frame().y()+rect.origin.y,rect.size.width,rect.size.height));
        rectShape.cornerRadiusFloat=5;

        // Add Mask layer.
        var shape=MSShapeGroup.alloc().init();
        shape.addLayers([rectShape]);

        var fill=shape.style().fills().addNewStylePart();
        fill.color = MSColor.colorWithSVGString("#dd0000");

        var border=shape.style().borders().addNewStylePart();
        var color = MSColor.whiteColor();
        color.alpha = 0;
        border.color = color;
        border.position = 1;

        shape.resizeRoot(true);

        shape.hasClippingMask=true;
        shape.setClippingMaskMode(1);

        layer.parentGroup().insertLayers_beforeLayer([shape],layer);

        // Group bitmap & mask
        var group=MSLayerGroup.groupFromLayers([shape,layer]);
        group.name=layer.name();

        // Flatten.
        var defaults=NSUserDefaults.standardUserDefaults();
        var bitmapFlattenScale=defaults.floatForKey("bitmapFlattenScale");
        defaults.setFloat_forKey(NSScreen.isOnRetinaScreen() ? 2 : 1,"bitmapFlattenScale");

        var flattener = MSLayerFlattener.alloc().init();
        var bitmap=flattener.imageFromLayers([group]);

        var images=doc.documentData().images();
        var image=[images addImage:bitmap convertColourspace:true];
        bitmap=[[MSBitmapLayer alloc] initWithImage:image parentFrame:null name:referenceLayerName];

        bitmap.frame().x=group.frame().x();
        bitmap.frame().y=group.frame().y();
        bitmap.frame().width=group.frame().width();
        bitmap.frame().height=group.frame().height();

        group.parentGroup().insertLayers_afterLayer([bitmap],group);
        group.removeFromParent();

        defaults.setFloat_forKey(bitmapFlattenScale,"bitmapFlattenScale");

        bitmap.select_byExpandingSelection(true,false);


    };

    root.ShadowRemoverTool = ShadowRemoverTool;

}).call(this);