var Files = {};

/** Load OBJ file */
Files.loadOBJ = function (data, mesh)
{
    var vertices = mesh.vertices_;
    var triangles = mesh.triangles_;
    var vAr = [],
    iAr = [];
    var lines = data.split('\n');
    var split = [];
    var nbLength = lines.length;
    for (var i = 0; i < nbLength; ++i)
    {
        var line = lines[i];
        line = line.trim();
        if (line.startsWith('v '))
        {
            split = line.split(/\s+/);
            vertices.push(new Vertex(vertices.length));
            vAr.push(parseFloat(split[1]), parseFloat(split[2]), parseFloat(split[3]));
        }
        else if (line.startsWith('f '))
        {
            split = line.split(/\s+/);
            var split1 = split[1].split('/'),
            split2 = split[2].split('/'),
            split3 = split[3].split('/');
            var iv1 = parseInt(split1[0], 10),
            iv2 = parseInt(split2[0], 10),
            iv3 = parseInt(split3[0], 10);

            var nbVertices = vertices.length;
            if (iv1 < 0)
            {
                iv1 += nbVertices;
                iv2 += nbVertices;
                iv3 += nbVertices;
            }
            else
            {
                --iv1;
                --iv2;
                --iv3;
            }
            var v1 = vertices[iv1],
            v2 = vertices[iv2],
            v3 = vertices[iv3];
            var nbTriangles = triangles.length;
            v1.tIndices_.push(nbTriangles);
            v2.tIndices_.push(nbTriangles);
            v3.tIndices_.push(nbTriangles);
            triangles.push(new Triangle(nbTriangles));
            iAr.push(iv1, iv2, iv3);
            //quad to triangle...
            if (split.length > 4)
            {
                ++nbTriangles;
                var iv4 = parseInt(split[4].split('/')[0], 10);
                if (iv4 < 0)
                    iv4 += nbVertices;
                else --iv4;
                var v4 = vertices[iv4];
                v1.tIndices_.push(nbTriangles);
                v3.tIndices_.push(nbTriangles);
                v4.tIndices_.push(nbTriangles);
                triangles.push(new Triangle(nbTriangles));
                iAr.push(iv1, iv3, iv4);
            }
        }
    }
    mesh.vertexArray_ = new Float32Array(vAr.length * 2);
    mesh.normalArray_ = new Float32Array(vAr.length * 2);
    mesh.indexArray_ = new SculptGL.indexArrayType(iAr.length * 2);
    mesh.vertexArray_.set(vAr);
    mesh.indexArray_.set(iAr);
};

/** Save OBJ file */
Files.exportOBJ = function (mesh, mtl_name)
{
    var vAr = mesh.vertexArray_;
    var iAr = mesh.indexArray_;
    var data = 's 0\n';

    if(mtl_name)
    {
        data += 'mtllib '+mtl_name+'.mtl\n'
        data += 'usemtl '+mtl_name+'\n'
    }
    var nbVertices = mesh.vertices_.length;
    var nbTriangles = mesh.triangles_.length;
    var i = 0,
    j = 0;
    for (i = 0; i < nbVertices; ++i)
    {
        j = i * 3;
        data += 'v ' + vAr[j] + ' ' + vAr[j + 1] + ' ' + vAr[j + 2] + '\n';
    }
    for (i = 0; i < nbTriangles; ++i)
    {
        j = i * 3;
        data += 'f ' + (1 + iAr[j]) + ' ' + (1 + iAr[j + 1]) + ' ' + (1 + iAr[j + 2]) + '\n';
    }
    return data;
};

Files.exportColorMtl = function (color)
{
    var data = 'newmtl color\n';
    var r = color.r / 255.0;
    var g = color.g / 255.0;
    var b = color.b / 255.0;
    data += 'Ka '+ r * 0.1 + ' ' + g * 0.1 + ' ' + b * 0.1 + '\n';
    data += 'Kd '+ r + ' ' + g + ' ' + b + '\n';
    data += 'Ks 1.0 1.0 1.0\n';
    data += 'Ns 200.0\n';
    data += 'd 1.0\n'; // no transparency
    return data;
};

/** Export OBJ file to Sketchfab */
Files.exportSketchfab = function (mesh, color)
{

    // create a zip containing the .obj model
    var model = Files.exportOBJ(mesh, "color");
    var mtl = Files.exportColorMtl(color);
    var zip = new JSZip();
    zip.file("model.obj", model);
    zip.file("color.mtl", mtl);
    var blob = zip.generate({type:"blob", compression:"DEFLATE"});

    var options = {
        "fileModel" : blob,
        "filenameModel": "model.zip",
        "title": ""
    };

    Sketchfab.showUploader(options);
};
