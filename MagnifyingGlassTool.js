(function(){

    var root = this;
    var MagnifyingGlassTool = {};

    var MAX_SIZE = 500;
    var MIN_SIZE = 2;

    var MagnifyingGlassShape = {
        None: "none",
        Oval: "oval",
        Rect: "rectangle"
    };

    var PlaceholderAction = {
        None: "none",
        Replace: "replace",
        Remove: "remove"
    };

    function resizeNSImage(anImage,width,height,interpolation) {
        var interpolation = interpolation || NSImageInterpolationNone;

        var sourceImage = anImage;
        sourceImage.setScalesWhenResized(true);

        if (!sourceImage.isValid()){
            return;
        } else {
            var smallImage = NSImage.alloc().initWithSize(NSMakeSize(width,height));
            smallImage.lockFocus();
            sourceImage.setSize(NSMakeSize(width,height));
            NSGraphicsContext.currentContext().setImageInterpolation(interpolation);
            [sourceImage drawAtPoint:NSZeroPoint fromRect:CGRectMake(0, 0,width,height) operation:NSCompositeCopy fraction:1.0];
            smallImage.unlockFocus();
            return smallImage;
        }

        return null;
    }

    MagnifyingGlassTool.validate = function(layer) {
        if(!layer.isKindOfClass(MSSliceLayer)) return;

        var width=layer.frame().width(),height=layer.frame().height();

        // Validate max size.
        if(width > MAX_SIZE || height > MAX_SIZE) {
            doc.displayMessage("Slice width or height can't exceed "+MAX_SIZE+" pixels.")
            return false;
        }

        // Validate min size.
        if(width < MIN_SIZE || height < MIN_SIZE) {
            doc.displayMessage("Slice width or height can't be less than "+MAX_SIZE+" pixels.")
            return;
        }

        return true;
    };

    MagnifyingGlassTool.loadDefaults = function() {

        var options=null;
        var path=fs.resolve("./meta/mg-defaults.json");

        if(!fs.exists(path)) {
            options = {
                zoom: 10,
                shape: MagnifyingGlassShape.Oval,
                drawGrid: true,
                placeholderAction: PlaceholderAction.Replace
            };
            this.saveDefaults(options);
        } else {
            options=fs.readJSON(path);
        }

        return options;
    };

    MagnifyingGlassTool.saveDefaults = function(options) {
        if(!fs.writeJSON(options,fs.resolve("./meta/mg-defaults.json"))) {
            throw new Error("Can't save mg-default.json file!");
        }
    };

    MagnifyingGlassTool.applyWithOptions = function(layer) {
        var defaults=this.loadDefaults();

        Alert.runModal({
            title: "Magnifying Glass Tool",
            description: "You can use any zoom value including fractional values (e.g, 5.5, 2.5, etc). The grid overlay is provided only for the listed zoom values.",
            icon: fs.resolveAsset("./magnifyingGlassIcon.png"),
            fields: {
                zoom: {
                    type: Alert.FieldType.Select,
                    label: "Zoom:",
                    value: ["2","4","8","10","16","24","32"],
                    defaultValue: defaults.zoom,
                    getter: function(value) {
                        var value=parseFloat(value);
                        if(value<1) value=1;
                        if(value>50) value=50;

                        return value;
                    }
                },
                shape: {
                    type: Alert.FieldType.Select,
                    label: "Shape:",
                    value: ["Oval","Rectangle"],
                    defaultValue: (defaults.shape==MagnifyingGlassShape.Oval) ? "Oval" : "Rectangle",
                    getter: function(value) {
                        // FIXME: This crap with getters and default setters should be replaced with a normal collection/map thing!
                        return (value.toLowerCase()=="rectangle") ? MagnifyingGlassShape.Rect : MagnifyingGlassShape.Oval
                    }
                },
                drawGrid: {
                    type: Alert.FieldType.Boolean,
                    label: "Draw Grid:",
                    value: defaults.drawGrid
                },
                placeholderAction: {
                    type: Alert.FieldType.Select,
                    label: "Placeholder Action:",
                    value: ["None","Replace with Highlighter","Remove"],
                    defaultValue: (function(){
                        // FIXME: This crap with getters and default setters should be replaced with a normal collection/map thing!
                        var map={
                            "none": "None",
                            "replace": "Replace with Highlighter",
                            "remove": "Remove"
                        };

                        if(map[defaults.placeholderAction]) {
                            return map[defaults.placeholderAction];
                        }

                        return "Replace with Highligher";
                    })(),
                    getter: function(value) {
                        // FIXME: This crap with getters and default setters should be replaced with a normal collection/map thing!
                        value=value.toLowerCase();
                        var map={
                            "none": PlaceholderAction.None,
                            "replace with highligher": PlaceholderAction.Replace,
                            "remove": PlaceholderAction.Remove
                        };

                        if(map[value]) {
                            return map[value];
                        }

                        return PlaceholderAction.Replace;
                    }
                }
            },
            buttons: [
                {
                    title: "OK",
                    onClick: function(data) {
                        MagnifyingGlassTool.saveDefaults(data);
                        MagnifyingGlassTool.apply(layer,data);
                    }
                },
                {
                    title: "Cancel",
                    onClick: function() {
                        // Operation was cancelled!
                    }
                }
            ]
        });
    };

    MagnifyingGlassTool.apply = function(layer,options) {

        var options = options || this.loadDefaults();

        var frame=layer.frame();
        var size=frame.size(),mid=frame.mid();

        if(options.shape==MagnifyingGlassShape.Oval) {
            var minSize=Math.min(size.width,size.height);
            frame.size=size=NSMakeSize(minSize,minSize);
            frame.mid=mid;
            frame.makeRectIntegral();
        }

        function bitmapLayerFromSlice(sliceLayer) {
            if(!sliceLayer) return null;

            layer.hasBackgroundColor=true;
            layer.backgroundColor=MSColor.whiteColor();

            var swapFilePath=fs.resolve("./meta/mg-crop.png");
            doc.saveArtboardOrSlice_toFile(layer,swapFilePath);

            var image =  NSImage.alloc().initWithContentsOfFile(swapFilePath);
            if(!image) {
                throw new Error("Can't load magnified bitmap swap file!");
                return null;
            }

            fs.remove(swapFilePath);

            var resizedImage=resizeNSImage(image,size.width*options.zoom,size.height*options.zoom);
            return Shaper.image(resizedImage,"Snapshot");
        }

        var bitmapLayer=bitmapLayerFromSlice(layer);
        if(!bitmapLayer) {
            throw new Error("Can't create bitmap layer from slice!");
            return;
        }

        function surroundLayerWithGlassDecoration(layer,options) {

            var group=Shaper.group("Magnifying Glass")
            var frame=layer.frame();
            var mid=frame.mid(),size=frame.size();

            var path=(options.shape==MagnifyingGlassShape.Oval) ?
                PathBuilder.oval(0,0,size.width,size.height) :
                PathBuilder.roundedRect(0,0,size.width,size.height,10);

            var maskLayer=Shaper.custom(path,"Mask");


            Shaper.border(maskLayer,{
                color: "#000000",
                thickness: 4,
                position: BorderPosition.Outside,
                alpha: 0.15
            });

            Shaper.border(maskLayer,{
                color: "#ffffff",
                thickness: 3,
                position: BorderPosition.Outside
            },true);

            maskLayer.frame().mid=mid;

            Shaper.shadow(layer,{
                color: "#000000",
                alpha: 0.2,
                y: 3,
                x: 0,
                blur: 7,
                spread: 0
            });

            Shaper.mask(maskLayer);

            var innerLayer=Shaper.custom(path,"Inner Frame");

            innerLayer.frame().size=size;
            innerLayer.frame().mid=mid;

            Shaper.border(innerLayer,{
                color: "#000000",
                thickness: 1,
                position: BorderPosition.Inside,
                alpha: 0.05
            });

            innerLayer.style().innerShadows().addNewStylePart();

            if(options.drawGrid) {
                switch(options.zoom) {
                    case 4: case 8: case 10: case 16: case 24: case 32: {
                        var grid=Shaper.rect(frame.x(),frame.y(),size.width,size.height);
                        var path=fs.resolveAsset("./mg-grids/mg_grid_"+options.zoom+".png");
                        Shaper.pattern(grid,fs.image(path));
                        group.addLayers([maskLayer,layer,grid,innerLayer]);
                    } break;
                    default: {
                        group.addLayers([maskLayer,layer,innerLayer]);
                    } break
                }


            } else {
                group.addLayers([maskLayer,layer,innerLayer]);
            }

            group.resizeRoot(true);

            return group;

        }

        var glassGroup=surroundLayerWithGlassDecoration(bitmapLayer,options);

        glassGroup.frame().x=layer.frame().maxX()+10;
        glassGroup.frame().y=layer.frame().minY();

        var parent=layer.parentGroup();
        parent.addLayers([glassGroup]);

        // Process placeholder.
        switch(options.placeholderAction) {
            case PlaceholderAction.Remove:
                parent.removeLayer(layer);
                break;
            case PlaceholderAction.Replace: {
                var name="Focus Point";
                var highlighter=(options.shape==MagnifyingGlassShape.Oval) ?
                    Shaper.oval(0,0,size.width,size.height,name) :
                    Shaper.rect(0,0,size.width,size.height,name);

                Shaper.fill(highlighter,{ color:"#ffffff", alpha: 0});
                Shaper.border(highlighter,{
                    color: "#D0021B",
                    thickness: 2,
                    position: BorderPosition.Outside
                });

                highlighter.frame().mid=mid;
                highlighter.frame().makeRectIntegral();

                parent.addLayers([highlighter]);
                parent.removeLayer(layer);
            }
                break;
        }

    };


    root.MagnifyingGlassTool = MagnifyingGlassTool;

}).call(this);