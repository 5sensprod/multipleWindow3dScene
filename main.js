import WindowManager from './WindowManager.js'



const t = THREE;
let camera, scene, renderer, world;
let near, far;
let pixR = window.devicePixelRatio ? window.devicePixelRatio : 1;
let cubes = [];
let sceneOffsetTarget = {x: 0, y: 0};
let sceneOffset = {x: 0, y: 0};

let spheres = [];

let today = new Date();
today.setHours(0);
today.setMinutes(0);
today.setSeconds(0);
today.setMilliseconds(0);
today = today.getTime();

let internalTime = getTime();
let windowManager;
let initialized = false;

// get time in seconds since beginning of the day (so that all windows use the same time)
function getTime ()
{
	return (new Date().getTime() - today) / 1000.0;
}


if (new URLSearchParams(window.location.search).get("clear"))
{
	localStorage.clear();
}
else
{	
	// this code is essential to circumvent that some browsers preload the content of some pages before you actually hit the url
	document.addEventListener("visibilitychange", () => 
	{
		if (document.visibilityState != 'hidden' && !initialized)
		{
			init();
		}
	});

	window.onload = () => {
		if (document.visibilityState != 'hidden')
		{
			init();
		}
	};

	function init ()
	{
		initialized = true;

		// add a short timeout because window.offsetX reports wrong values before a short period 
		setTimeout(() => {
			setupScene();
			setupWindowManager();
			resize();
			updateWindowShape(false);
			render();
			window.addEventListener('resize', resize);
		}, 500)	
	}

	function createParticleSphere(color, size) {
		const geometry = new t.Geometry();
		const material = new t.PointsMaterial({ color: color, size: 0.5 });
		const particleCount = 5000; // Augmentez pour une densité plus élevée
		const radius = size / 2;
	
		for (let i = 0; i < particleCount; i++) {
			let phi = Math.random() * Math.PI * 2;
			let theta = Math.random() * Math.PI;
			let r = Math.random() * radius; // Choix aléatoire d'un rayon pour remplir la sphère
			let x = r * Math.sin(theta) * Math.cos(phi);
			let y = r * Math.sin(theta) * Math.sin(phi);
			let z = r * Math.cos(theta);
	
			geometry.vertices.push(new t.Vector3(x, y, z));
		}
	
		return new t.Points(geometry, material);
	}

	function createParticleCube(winShape, color, size) {
		const geometry = new t.Geometry();
		const material = new t.PointsMaterial({ color: color, size: 2 });
		const particleCount = 1000; // Nombre de particules dans chaque "cube"
	
		for (let i = 0; i < particleCount; i++) {
			let x = (Math.random() - 0.5) * size;
			let y = (Math.random() - 0.5) * size;
			let z = (Math.random() - 0.5) * size;
	
			geometry.vertices.push(new t.Vector3(x, y, z));
		}
	
		const particleCube = new t.Points(geometry, material);
		particleCube.position.x = winShape.x + (winShape.w * 0.5);
		particleCube.position.y = winShape.y + (winShape.h * 0.5);
	
		return particleCube;
	}

	function applyInertiaToSpheres() {
		spheres.forEach(sphere => {
			// Appliquer l'effet d'inertie
			sphere.position.x += windowVelocity.x * 0.1;
			sphere.position.y += windowVelocity.y * 0.1;
		});
	}
	
	function generateUniqueColor(index) {
		let c = new t.Color();
		c.setHSL(index * 0.1 % 1, 1.0, 0.5);
		return c.getHex();
	}

	function setupScene ()
	{
		camera = new t.OrthographicCamera(0, 0, window.innerWidth, window.innerHeight, -10000, 10000);
		
		camera.position.z = 2.5;
		near = camera.position.z - .5;
		far = camera.position.z + 0.5;

		scene = new t.Scene();
		scene.background = new t.Color(0.0);
		scene.add( camera );

		renderer = new t.WebGLRenderer({antialias: true, depthBuffer: true});
		renderer.setPixelRatio(pixR);
	    
	  	world = new t.Object3D();
		scene.add(world);

		renderer.domElement.setAttribute("id", "scene");
		document.body.appendChild( renderer.domElement );
	}

	function setupWindowManager ()
	{
		windowManager = new WindowManager();
		windowManager.setWinShapeChangeCallback(updateWindowShape);
		windowManager.setWinChangeCallback(windowsUpdated);

		// here you can add your custom metadata to each windows instance
		let metaData = {foo: "bar"};

		// this will init the windowmanager and add this window to the centralised pool of windows
		windowManager.init(metaData);

		// call update windows initially (it will later be called by the win change callback)
		windowsUpdated();
	}

	function windowsUpdated ()
	{
		updateNumberOfCubes();
	}

	function updateNumberOfCubes() {
		let wins = windowManager.getWindows();

    // Retirer toutes les sphères existantes
    cubes.forEach((c) => {
        world.remove(c);
    });

    cubes = [];

    // Ajouter de nouvelles sphères de particules
    for (let i = 0; i < wins.length; i++) {
        let win = wins[i];
        let color = generateUniqueColor(i);
        let size = 100 + i * 50; // Taille de la sphère
        let particleSphere = createParticleSphere(color, size);
        particleSphere.position.x = win.shape.x + (win.shape.w * 0.5);
        particleSphere.position.y = win.shape.y + (win.shape.h * 0.5);
        world.add(particleSphere);
        cubes.push(particleSphere);
    }
	}

	function updateWindowShape (easing = true)
	{
		// storing the actual offset in a proxy that we update against in the render function
		sceneOffsetTarget = {x: -window.screenX, y: -window.screenY};
		if (!easing) sceneOffset = sceneOffsetTarget;
	}


	function render ()
	{
		let t = getTime();

		windowManager.update();


		// calculate the new position based on the delta between current offset and new offset times a falloff value (to create the nice smoothing effect)
		let falloff = .05;
		sceneOffset.x = sceneOffset.x + ((sceneOffsetTarget.x - sceneOffset.x) * falloff);
		sceneOffset.y = sceneOffset.y + ((sceneOffsetTarget.y - sceneOffset.y) * falloff);

		// set the world position to the offset
		world.position.x = sceneOffset.x;
		world.position.y = sceneOffset.y;

		let wins = windowManager.getWindows();


		// loop through all our cubes and update their positions based on current window positions
		for (let i = 0; i < cubes.length; i++)
		{
			let cube = cubes[i];
			let win = wins[i];
			let _t = t;// + i * .2;

			let posTarget = {x: win.shape.x + (win.shape.w * .5), y: win.shape.y + (win.shape.h * .5)}

			cube.position.x = cube.position.x + (posTarget.x - cube.position.x) * falloff;
			cube.position.y = cube.position.y + (posTarget.y - cube.position.y) * falloff;
			cube.rotation.x = _t * .5;
			cube.rotation.y = _t * .3;
		};
		applyInertiaToSpheres();

		renderer.render(scene, camera);
		requestAnimationFrame(render);
	}


	// resize the renderer to fit the window size
	function resize ()
	{
		let width = window.innerWidth;
		let height = window.innerHeight
		
		camera = new t.OrthographicCamera(0, width, 0, height, -10000, 10000);
		camera.updateProjectionMatrix();
		renderer.setSize( width, height );
	}
}