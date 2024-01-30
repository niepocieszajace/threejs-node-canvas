const {Canvas: CanvasClass} = require("canvas");
const THREE = require("three");
const fs = require("fs");
const EventEmitter = require('events');
const createGLContext = require('gl');
const getPixels = require('get-pixels')

const _ctx = Symbol('ctx');

function putImageData(gl, canvas) {
    const {width, height} = canvas;
    const ctx = canvas[_ctx];

    const data = ctx.getImageData(0, 0, width, height);

    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    for (let i = 0; i < height; i++) {
        for (let j = 0; j < width; j++) {
            const col = j;
            const row = height - i - 1;
            for (let k = 0; k < 4; k++) {
                const idx = 4 * (row * width + col) + k;
                const idx2 = 4 * (i * width + col) + k;
                data.data[idx] = pixels[idx2];
            }
        }
    }

    ctx.putImageData(data, 0, 0);
    return ctx;
}

class Canvas extends CanvasClass {
    constructor(...args) {
        super(...args);
        this.__event__ = new EventEmitter();
        this.__attributes__ = {};
        this.style = {};
    }

    get width() {
        return super.width;
    }

    set width(value) {
        if (this.__gl__) {
            const ext = this.__gl__.getExtension('STACKGL_resize_drawingbuffer');
            ext.resize(value, this.height);
        }
        super.width = value;
    }

    get height() {
        return super.height;
    }

    set height(value) {
        if (this.__gl__) {
            const ext = this.__gl__.getExtension('STACKGL_resize_drawingbuffer');
            ext.resize(this.width, value);
        }
        super.height = value;
    }

    get __ctx__() {
        return this[_ctx];
    }

    getContext(type, options) {
        if (this.__contextType__ && this.__contextType__ !== type) return null;
        if (this.__gl__) return this.__gl__;
        this.__contextType__ = type;
        if (type === 'webgl' || type === 'webgl2') {
            const {width, height} = this;
            this[_ctx] = super.getContext('2d', options);
            const ctx = createGLContext(width, height, options);

            ctx.canvas = this;

            this.__gl__ = ctx;
            return this.__gl__;
        }
        return super.getContext(type, options);
    }

    toBuffer(...args) {
        const gl = this.__gl__;
        if (gl) {
            putImageData(gl, this);
        }
        return super.toBuffer(...args);
    }

    // toDataURL(...args) {
    //     const gl = this.__gl__;
    //     if(gl) {
    //         putImageData(gl, this);
    //     }
    //     return super.toDataURL(...args);
    // }

    // createPNGStream(...args) {
    //     const gl = this.__gl__;
    //     if(gl) {
    //         putImageData(gl, this);
    //     }
    //     return super.createPNGStream(...args);
    // }

    // createJPEGStream(...args) {
    //     const gl = this.__gl__;
    //     if(gl) {
    //         putImageData(gl, this);
    //     }
    //     return super.createJPEGStream(...args);
    // }

    // createPDFStream(...args) {
    //     const gl = this.__gl__;
    //     if(gl) {
    //         putImageData(gl, this);
    //     }
    //     return super.createPDFStream(...args);
    // }

    addEventListener(type, listener) {
        return this.__event__.addListener(type, listener);
    }

    removeEventListener(type, listener) {
        if (listener) {
            return this.__event__.removeListener(type, listener);
        }
        return this.removeAllListeners(type);
    }

    dispatchEvent(event) {
        event.target = this;
        return this.emit(event.type, event);
    }

    setAttribute(key, value) {
        this.__attributes__[key] = value;

        if (key === 'width') {
            this.width = value;
        }

        if (key === 'height') {
            this.height = value;
        }
    }

    getAttribute(key) {
        if (key === 'width') {
            return this.width;
        }
        if (key === 'height') {
            return this.height;
        }
        return this.__attributes__[key];
    }

    removeAttribute(key) {
        delete this.__attributes__[key];
    }
}

const createCanvas = (width, height) => new Canvas(width, height);

const loadTextureAsync = async (path) => {
    return new Promise((resolve, reject) => {
        getPixels(path, function (err, pixels) {
            if (err) {
                console.log("Failed to load texture using get-pixels:", err);
                reject(err)
                return;
            }

            const texture = new THREE.DataTexture(new Uint8Array(pixels.data), pixels.shape[0], pixels.shape[1], THREE.RGBAFormat);
            texture.needsUpdate = true;

            resolve(texture)
        });
    })
}

async function virtualizeCanvas() {

    this.width = 512
    this.height = 512

    console.log('Initializing canvas...');
    const canvas = createCanvas(this.width, this.height, {alpha: true})

    console.log('Creating renderer...');
    const renderer = new THREE.WebGLRenderer({canvas, alpha: true, antialias: true});
    renderer.setSize(this.width, this.height);

    console.log('Creating scene...')
    const camera = new THREE.PerspectiveCamera(75, this.width / this.height, 0.1, 1000);
    camera.position.z = 9;

    const scene = new THREE.Scene();

    const ambientLight = new THREE.AmbientLight(0x404040, 1000);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xffffff, 100);
    pointLight.position.set(0, 7, 10);
    scene.add(pointLight);

    const pointLight2 = new THREE.PointLight(0xffffff, 10);
    pointLight2.position.set(0, -9, 10);
    scene.add(pointLight2);

    console.log('Loading texture...');
    const txt = await loadTextureAsync(__dirname + "/textures/checkerboard-1024x1024.png")

    console.log('Creating material...')
    const material = new THREE.MeshStandardMaterial({
        color: 0x049ef4,
        emissive: 0x000000,
        roughness: 0.9,
        metalness: 1,
        map: txt
    });

    console.log('Creating sphere...');

    const geometry = new THREE.SphereGeometry(5, 25, 28);
    const sphere = new THREE.Mesh(geometry, material);
    scene.add(sphere);

    console.log('Rendering canvas...')
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);

    const buffer = canvas.toBuffer();

    console.log('Saving file...')
    fs.writeFile(__dirname + `\\dist\\image.png`, buffer, (err) => {
        if (err) throw err;
        console.log('The file has been saved!');
    })
}

function init() {
    virtualizeCanvas()
}

init()