(function(){

    var root = this;

    var _ = {
        isUndefined: function(obj) {
            return toString.call(obj)=="[object Undefined]";
        },
        isDefined: function(obj) {
            return toString.call(obj)!="[object Undefined]";
        }
    };

    var fs = {
        resolve: function(path) {
            // FIXME: Should be universal!
            return sketch.scriptPath.stringByDeletingLastPathComponent()+"/"+path;
        },

        resolveAsset: function(path) {
            return this.resolve("/assets/"+path)
        },

        image: function(path) {
            if(!this.exists(path)) {
                throw new Error("Specified image file isn't exist at path '"+path+"'");
                return null;
            }

            return NSImage.alloc().initWithContentsOfFile(path)
        },

        exists: function(path) {
            return NSFileManager.defaultManager().fileExistsAtPath(path);
        },

        remove: function(path) {
            NSFileManager.defaultManager().removeItemAtPath_error(path,null);
        },

        writeString: function(obj,path) {
            return NSString.stringWithString(obj).writeToFile_atomically_encoding_error(path,true,NSUTF8StringEncoding,null);
        },

        readString: function(path) {
            return NSString.stringWithContentsOfFile_encoding_error(path,NSUTF8StringEncoding,null);
        },

        readJSON: function(path) {
            var obj=null;
            try {
                obj=JSON.parse(this.readString(path));
            } catch(e) {
                throw new Error("Can't parse JSON string!")
            }
            return obj;
        },
        writeJSON: function(obj,path) {
            return this.writeString(JSON.stringify(obj,null,4),path);
        }
    };

    var PathBuilder = {
        rect: function(x,y,width,height) {
            return NSBezierPath.bezierPathWithRect(NSMakeRect(x,y,width,height));
        },
        oval: function(x,y,width,height) {
            return NSBezierPath.bezierPathWithOvalInRect(NSMakeRect(x,y,width,height));
        },
        roundedRect: function(x,y,width,height,radius) {
            return [NSBezierPath bezierPathWithRoundedRect:NSMakeRect(x,y,width,height) xRadius:radius yRadius:radius];
        }
    };

    var Shaper = {

        fill: function(layer,options) {
            var addNew=addNew || false;
            var fill=(addNew) ? layer.style().fills().addNewStylePart() : layer.style().fill();
            if(!fill) fill=layer.style().fills().addNewStylePart();
            if(_.isDefined(options.color)) fill.color=this.colorWithHex(options.color, _.isDefined(options.alpha) ? options.alpha : 1);
        },
        border: function(layer,options,addNew) {
            var addNew=addNew || false;
            var border=(addNew) ? layer.style().borders().addNewStylePart() : layer.style().border();
            if(!border) border=layer.style().borders().addNewStylePart();
            if(_.isDefined(options.color)) border.color=this.colorWithHex(options.color, _.isDefined(options.alpha) ? options.alpha : 1);
            if(_.isDefined(options.thickness)) border.thickness=options.thickness;
            if(_.isDefined(options.position)) border.position=options.position;
        },
        shadow: function(layer,options) {
            if(_.isUndefined(options)) {
                layer.style().shadows().addNewStylePart();
                return;
            }

            if (![[layer style] shadow]) {
                [[[layer style] shadows] addNewStylePart];
                var shadow = [[layer style] shadow];

                [shadow setOffsetX:options.x];
                [shadow setOffsetY:options.y];
                [shadow setBlurRadius:options.blur];
                [shadow setSpread:options.spread];

                var color=MSColor.colorWithSVGString(options.color);
                color.alpha=options.alpha;
                shadow.setColor(color);
            }

        },
        colorWithHex: function(hexColor,alpha) {
            var color=MSColor.colorWithSVGString(hexColor);
            color.alpha=alpha;

            return color;
        },

        mask: function(layer,mode) {
            var mode = mode || MaskMode.Outline;
            layer.hasClippingMask=true;
            layer.clippingMaskMode=mode;
        },

        group: function(name) {
            var name = name || "Group";
            var group=MSLayerGroup.alloc().init();
            group.name=name;

            return group;
        },

        pattern: function(layer,nsImage) {
            var fill=layer.style().fill();
            if(!fill) fill=layer.style().fills().addNewStylePart();

            fill.fillType=FillType.Pattern;
            fill.setPatternImage_collection(nsImage,doc.documentData().images());
            fill.patternFillType=ImageFillPattern.Tile;
            fill.patternTileScale=1;
        },

        custom: function(path,name) {
            var name=name || "Shape";
            var shape=MSShapeGroup.shapeWithBezierPath(path);
            shape.name=name;

            return shape;
        },

        rect: function (x,y,width,height,name) {
            return this.custom(PathBuilder.rect(x,y,width,height),name);
        },

        oval: function (x,y,width,height,name) {
            return this.custom(PathBuilder.oval(x,y,width,height),name);
        },

        add: function(parent,layer) {
            parent.addLayers([layer]);
        },

        insertBefore: function(parent,layer) {
            // FIXME: to implement!
        },

        insertAfter: function(parent,layer) {
            // FIXME: to implement!
        },

        image: function(nsImage,name) {
            var name= name || "Image";

            var images=doc.documentData().images();
            var image=[images addImage:nsImage convertColourspace:true];

            var layer=[[MSBitmapLayer alloc] initWithImage:image parentFrame:null name:"Image"];
            layer.name=name;

            return layer;
        }
    };

    root.fs = fs;
    root._ = _;
    root.PathBuilder = PathBuilder;
    root.Shaper = Shaper;

    // Global Enums.
    root.BorderPosition = {
        Center: 0,
        Inside: 1,
        Outside: 2,
        InsideOutside: 3
    };

    root.ImageFillPattern = {
        Tile: 0,
        Fill: 1
    };

    root.FillType = {
        Solid: 0,
        Gradient: 1,
        Pattern: 4,
        Noise: 5
    };

    root.MaskMode = {
        Outline: 0,
        Alpha: 1
    };



}).call(this);