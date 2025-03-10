import marchingCubesShaderCode from '../shaders/marchingCubes.wgsl';

/*
    Bindings:
    @group(0) @binding(0) var noise_texture: texture_3d<f32>;
    @group(0) @binding(1) var<uniform> settings: Settings;

    @group(0) @binding(2) var<storage, read_write> atomics: Atomics;
    @group(0) @binding(3) var<storage, read_write> vertices: array<Vertex>;
    @group(0) @binding(4) var<storage, read_write> indices: array<u32>;

    @group(0) @binding(5) var<uniform> triLUT: array<array<vec3i, 5>, 256>;
    @group(0) @binding(6) var<uniform> edgeLUT: array<u32, 256>;
*/
export function setupMarchingCubesStage(device, config, noiseTexture) {
    const marchingCubesStage = {};

    marchingCubesStage.module = device.createShaderModule({
        label: "Marching Cubes Shader",
        code: marchingCubesShaderCode,
    });
    
    marchingCubesStage.settingsBuffer = device.createBuffer({
        label: "Marching Cubes Settings",
        size: 8,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    marchingCubesStage.settings = {
        isoValue: 0.5,
        interpolationFactor: 1.0,
    };

    marchingCubesStage.updateSettingsBuffer = () => {
        device.queue.writeBuffer(marchingCubesStage.settingsBuffer, 0, new Float32Array([marchingCubesStage.settings.isoValue, marchingCubesStage.settings.interpolationFactor]));
    };
    marchingCubesStage.updateSettingsBuffer(); // Initial update

    marchingCubesStage.indirectArgsBuffer = device.createBuffer({
        label: "Marching Cubes Atomics",
        size: 24,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.INDIRECT | GPUBufferUsage.COPY_DST,
    });

    device.queue.writeBuffer(marchingCubesStage.indirectArgsBuffer, 0, new Uint32Array([0, 0, 1, 0, 0, 0]));

    const cellCount = config.cellCountX * config.cellCountY * config.cellCountZ;

    marchingCubesStage.vertexBuffer = device.createBuffer({
        label: "Marching Cubes Vertices",
        size: cellCount * 12 * 6 * 4, //Each cell can potentially have 12 vertices, each vertex is 6 floats, each float is 4 bytes
        usage: GPUBufferUsage.STORAGE |  GPUBufferUsage.VERTEX ,
    });

    marchingCubesStage.indexBuffer = device.createBuffer({
        label: "Marching Cubes Indices",
        size: cellCount * 5 * 3 * 4, //Each cell can potentially have 5 triangles, each triangle has 3 indices, each index is 4 bytes
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.INDEX,
    });
    
    marchingCubesStage.LUT = device.createBuffer({
        label: "Marching Cubes LUT",
        size: 256 * 24 * 4,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    device.queue.writeBuffer(marchingCubesStage.LUT, 0, LUT);

    marchingCubesStage.bindGroupLayout = device.createBindGroupLayout({
        label: "Marching Cubes Bind Group Layout",
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.COMPUTE,
                texture: {
                    sampleType: "unfilterable-float",
                    viewDimension: "3d",
                }
            },
            {
                binding: 1,
                visibility: GPUShaderStage.COMPUTE,
                buffer: {
                    type: "uniform",
                }
            },
            {
                binding: 2,
                visibility: GPUShaderStage.COMPUTE,
                buffer: {
                    type: "storage",
                }
            },
            {
                binding: 3,
                visibility: GPUShaderStage.COMPUTE,
                buffer: {
                    type: "storage",
                }
            },
            {
                binding: 4,
                visibility: GPUShaderStage.COMPUTE,
                buffer: {
                    type: "storage",
                }
            },
            {
                binding: 5,
                visibility: GPUShaderStage.COMPUTE,
                buffer: {
                    type: "uniform",
                }
            },
        ],
    });

    marchingCubesStage.bindGroup = device.createBindGroup({
        label: "Marching Cubes Bind Group",
        layout: marchingCubesStage.bindGroupLayout,
        entries: [
            {
                binding: 0,
                resource: noiseTexture.createView(),
            },
            {
                binding: 1,
                resource: {
                    buffer: marchingCubesStage.settingsBuffer,
                },
            },
            {
                binding: 2,
                resource: {
                    buffer: marchingCubesStage.indirectArgsBuffer,
                },
            },
            {
                binding: 3,
                resource: {
                    buffer: marchingCubesStage.vertexBuffer,
                },
            },
            {
                binding: 4,
                resource: {
                    buffer: marchingCubesStage.indexBuffer,
                },
            },
            {
                binding: 5,
                resource: {
                    buffer: marchingCubesStage.LUT,
                },
            },
        ],
    });

    marchingCubesStage.pipelineLayout = device.createPipelineLayout({
        label: "Marching Cubes Pipeline Layout",
        bindGroupLayouts: [marchingCubesStage.bindGroupLayout],
    });

    marchingCubesStage.pipeline = device.createComputePipeline({
        label: "Marching Cubes Pipeline",
        layout: marchingCubesStage.pipelineLayout,
        compute: {
            module: marchingCubesStage.module,
            entryPoint: "main",
        },
    });

    return marchingCubesStage;
}

const LUT = new Uint32Array([
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    1,3,265,0,0,8,3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    1,3,515,0,0,1,9,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    2,4,778,0,1,8,3,0,9,8,1,0,0,0,0,0,0,0,0,0,0,0,0,0,
    1,3,1030,0,1,2,10,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    2,6,1295,0,0,8,3,0,1,2,10,0,0,0,0,0,0,0,0,0,0,0,0,0,
    2,4,1541,0,9,2,10,0,0,2,9,0,0,0,0,0,0,0,0,0,0,0,0,0,
    3,5,1804,0,2,8,3,0,2,10,8,0,10,9,8,0,0,0,0,0,0,0,0,0,
    1,3,2060,0,3,11,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    2,4,2309,0,0,11,2,0,8,11,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    2,6,2575,0,1,9,0,0,2,3,11,0,0,0,0,0,0,0,0,0,0,0,0,0,
    3,5,2822,0,1,11,2,0,1,9,11,0,9,8,11,0,0,0,0,0,0,0,0,0,
    2,4,3082,0,3,10,1,0,11,10,3,0,0,0,0,0,0,0,0,0,0,0,0,0,
    3,5,3331,0,0,10,1,0,0,8,10,0,8,11,10,0,0,0,0,0,0,0,0,0,
    3,5,3593,0,3,9,0,0,3,11,9,0,11,10,9,0,0,0,0,0,0,0,0,0,
    2,4,3840,0,9,8,10,0,10,8,11,0,0,0,0,0,0,0,0,0,0,0,0,0,
    1,3,400,0,4,7,8,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    2,4,153,0,4,3,0,0,7,3,4,0,0,0,0,0,0,0,0,0,0,0,0,0,
    2,6,915,0,0,1,9,0,8,4,7,0,0,0,0,0,0,0,0,0,0,0,0,0,
    3,5,666,0,4,1,9,0,4,7,1,0,7,3,1,0,0,0,0,0,0,0,0,0,
    2,6,1430,0,1,2,10,0,8,4,7,0,0,0,0,0,0,0,0,0,0,0,0,0,
    3,7,1183,0,3,4,7,0,3,0,4,0,1,2,10,0,0,0,0,0,0,0,0,0,
    3,7,1941,0,9,2,10,0,9,0,2,0,8,4,7,0,0,0,0,0,0,0,0,0,
    4,6,1692,0,2,10,9,0,2,9,7,0,2,7,3,0,7,9,4,0,0,0,0,0,
    2,6,2460,0,8,4,7,0,3,11,2,0,0,0,0,0,0,0,0,0,0,0,0,0,
    3,5,2197,0,11,4,7,0,11,2,4,0,2,0,4,0,0,0,0,0,0,0,0,0,
    3,9,2975,0,9,0,1,0,8,4,7,0,2,3,11,0,0,0,0,0,0,0,0,0,
    4,6,2710,0,4,7,11,0,9,4,11,0,9,11,2,0,9,2,1,0,0,0,0,0,
    3,7,3482,0,3,10,1,0,3,11,10,0,7,8,4,0,0,0,0,0,0,0,0,0,
    4,6,3219,0,1,11,10,0,1,4,11,0,1,0,4,0,7,11,4,0,0,0,0,0,
    4,8,3993,0,4,7,8,0,9,0,11,0,9,11,10,0,11,0,3,0,0,0,0,0,
    3,5,3728,0,4,7,11,0,4,11,9,0,9,11,10,0,0,0,0,0,0,0,0,0,
    1,3,560,0,9,5,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    2,6,825,0,9,5,4,0,0,8,3,0,0,0,0,0,0,0,0,0,0,0,0,0,
    2,4,51,0,0,5,4,0,1,5,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    3,5,314,0,8,5,4,0,8,3,5,0,3,1,5,0,0,0,0,0,0,0,0,0,
    2,6,1590,0,1,2,10,0,9,5,4,0,0,0,0,0,0,0,0,0,0,0,0,0,
    3,9,1855,0,3,0,8,0,1,2,10,0,4,9,5,0,0,0,0,0,0,0,0,0,
    3,5,1077,0,5,2,10,0,5,4,2,0,4,0,2,0,0,0,0,0,0,0,0,0,
    4,6,1340,0,2,10,5,0,3,2,5,0,3,5,4,0,3,4,8,0,0,0,0,0,
    2,6,2620,0,9,5,4,0,2,3,11,0,0,0,0,0,0,0,0,0,0,0,0,0,
    3,7,2869,0,0,11,2,0,0,8,11,0,4,9,5,0,0,0,0,0,0,0,0,0,
    3,7,2111,0,0,5,4,0,0,1,5,0,2,3,11,0,0,0,0,0,0,0,0,0,
    4,6,2358,0,2,1,5,0,2,5,8,0,2,8,11,0,4,8,5,0,0,0,0,0,
    3,7,3642,0,10,3,11,0,10,1,3,0,9,5,4,0,0,0,0,0,0,0,0,0,
    4,8,3891,0,4,9,5,0,0,8,1,0,8,10,1,0,8,11,10,0,0,0,0,0,
    4,6,3129,0,5,4,0,0,5,0,11,0,5,11,10,0,11,0,3,0,0,0,0,0,
    3,5,3376,0,5,4,8,0,5,8,10,0,10,8,11,0,0,0,0,0,0,0,0,0,
    2,4,928,0,9,7,8,0,5,7,9,0,0,0,0,0,0,0,0,0,0,0,0,0,
    3,5,681,0,9,3,0,0,9,5,3,0,5,7,3,0,0,0,0,0,0,0,0,0,
    3,5,419,0,0,7,8,0,0,1,7,0,1,5,7,0,0,0,0,0,0,0,0,0,
    2,4,170,0,1,5,3,0,3,5,7,0,0,0,0,0,0,0,0,0,0,0,0,0,
    3,7,1958,0,9,7,8,0,9,5,7,0,10,1,2,0,0,0,0,0,0,0,0,0,
    4,8,1711,0,10,1,2,0,9,5,0,0,5,3,0,0,5,7,3,0,0,0,0,0,
    4,6,1445,0,8,0,2,0,8,2,5,0,8,5,7,0,10,5,2,0,0,0,0,0,
    3,5,1196,0,2,10,5,0,2,5,3,0,3,5,7,0,0,0,0,0,0,0,0,0,
    3,7,2988,0,7,9,5,0,7,8,9,0,3,11,2,0,0,0,0,0,0,0,0,0,
    4,6,2725,0,9,5,7,0,9,7,2,0,9,2,0,0,2,7,11,0,0,0,0,0,
    4,8,2479,0,2,3,11,0,0,1,8,0,1,7,8,0,1,5,7,0,0,0,0,0,
    3,5,2214,0,11,2,1,0,11,1,7,0,7,1,5,0,0,0,0,0,0,0,0,0,
    4,8,4010,0,9,5,8,0,8,5,7,0,10,1,3,0,10,3,11,0,0,0,0,0,
    5,7,3747,0,5,7,0,0,5,0,9,0,7,11,0,0,1,0,10,0,11,10,0,0,
    5,7,3497,0,11,10,0,0,11,0,3,0,10,5,0,0,8,0,7,0,5,7,0,0,
    2,4,3232,0,11,10,5,0,7,11,5,0,0,0,0,0,0,0,0,0,0,0,0,0,
    1,3,1120,0,10,6,5,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    2,6,1385,0,0,8,3,0,5,10,6,0,0,0,0,0,0,0,0,0,0,0,0,0,
    2,6,1635,0,9,0,1,0,5,10,6,0,0,0,0,0,0,0,0,0,0,0,0,0,
    3,7,1898,0,1,8,3,0,1,9,8,0,5,10,6,0,0,0,0,0,0,0,0,0,
    2,4,102,0,1,6,5,0,2,6,1,0,0,0,0,0,0,0,0,0,0,0,0,0,
    3,7,367,0,1,6,5,0,1,2,6,0,3,0,8,0,0,0,0,0,0,0,0,0,
    3,5,613,0,9,6,5,0,9,0,6,0,0,2,6,0,0,0,0,0,0,0,0,0,
    4,6,876,0,5,9,8,0,5,8,2,0,5,2,6,0,3,2,8,0,0,0,0,0,
    2,6,3180,0,2,3,11,0,10,6,5,0,0,0,0,0,0,0,0,0,0,0,0,0,
    3,7,3429,0,11,0,8,0,11,2,0,0,10,6,5,0,0,0,0,0,0,0,0,0,
    3,9,3695,0,0,1,9,0,2,3,11,0,5,10,6,0,0,0,0,0,0,0,0,0,
    4,8,3942,0,5,10,6,0,1,9,2,0,9,11,2,0,9,8,11,0,0,0,0,0,
    3,5,2154,0,6,3,11,0,6,5,3,0,5,1,3,0,0,0,0,0,0,0,0,0,
    4,6,2403,0,0,8,11,0,0,11,5,0,0,5,1,0,5,11,6,0,0,0,0,0,
    4,6,2665,0,3,11,6,0,0,3,6,0,0,6,5,0,0,5,9,0,0,0,0,0,
    3,5,2912,0,6,5,9,0,6,9,11,0,11,9,8,0,0,0,0,0,0,0,0,0,
    2,6,1520,0,5,10,6,0,4,7,8,0,0,0,0,0,0,0,0,0,0,0,0,0,
    3,7,1273,0,4,3,0,0,4,7,3,0,6,5,10,0,0,0,0,0,0,0,0,0,
    3,9,2035,0,1,9,0,0,5,10,6,0,8,4,7,0,0,0,0,0,0,0,0,0,
    4,8,1786,0,10,6,5,0,1,9,7,0,1,7,3,0,7,9,4,0,0,0,0,0,
    3,7,502,0,6,1,2,0,6,5,1,0,4,7,8,0,0,0,0,0,0,0,0,0,
    4,8,255,0,1,2,5,0,5,2,6,0,3,0,4,0,3,4,7,0,0,0,0,0,
    4,8,1013,0,8,4,7,0,9,0,5,0,0,6,5,0,0,2,6,0,0,0,0,0,
    5,7,764,0,7,3,9,0,7,9,4,0,3,2,9,0,5,9,6,0,2,6,9,0,
    3,9,3580,0,3,11,2,0,7,8,4,0,10,6,5,0,0,0,0,0,0,0,0,0,
    4,8,3317,0,5,10,6,0,4,7,2,0,4,2,0,0,2,7,11,0,0,0,0,0,
    4,12,4095,0,0,1,9,0,4,7,8,0,2,3,11,0,5,10,6,0,0,0,0,0,
    5,9,3830,0,9,2,1,0,9,11,2,0,9,4,11,0,7,11,4,0,5,10,6,0,
    4,8,2554,0,8,4,7,0,3,11,5,0,3,5,1,0,5,11,6,0,0,0,0,0,
    5,7,2291,0,5,1,11,0,5,11,6,0,1,0,11,0,7,11,4,0,0,4,11,0,
    5,9,3065,0,0,5,9,0,0,6,5,0,0,3,6,0,11,6,3,0,8,4,7,0,
    4,6,2800,0,6,5,9,0,6,9,11,0,4,7,9,0,7,11,9,0,0,0,0,0,
    2,4,1616,0,10,4,9,0,6,4,10,0,0,0,0,0,0,0,0,0,0,0,0,0,
    3,7,1881,0,4,10,6,0,4,9,10,0,0,8,3,0,0,0,0,0,0,0,0,0,
    3,5,1107,0,10,0,1,0,10,6,0,0,6,4,0,0,0,0,0,0,0,0,0,0,
    4,6,1370,0,8,3,1,0,8,1,6,0,8,6,4,0,6,1,10,0,0,0,0,0,
    3,5,598,0,1,4,9,0,1,2,4,0,2,6,4,0,0,0,0,0,0,0,0,0,
    4,8,863,0,3,0,8,0,1,2,9,0,2,4,9,0,2,6,4,0,0,0,0,0,
    2,4,85,0,0,2,4,0,4,2,6,0,0,0,0,0,0,0,0,0,0,0,0,0,
    3,5,348,0,8,3,2,0,8,2,4,0,4,2,6,0,0,0,0,0,0,0,0,0,
    3,7,3676,0,10,4,9,0,10,6,4,0,11,2,3,0,0,0,0,0,0,0,0,0,
    4,8,3925,0,0,8,2,0,2,8,11,0,4,9,10,0,4,10,6,0,0,0,0,0,
    4,8,3167,0,3,11,2,0,0,1,6,0,0,6,4,0,6,1,10,0,0,0,0,0,
    5,7,3414,0,6,4,1,0,6,1,10,0,4,8,1,0,2,1,11,0,8,11,1,0,
    4,6,2650,0,9,6,4,0,9,3,6,0,9,1,3,0,11,6,3,0,0,0,0,0,
    5,7,2899,0,8,11,1,0,8,1,0,0,11,6,1,0,9,1,4,0,6,4,1,0,
    3,5,2137,0,3,11,6,0,3,6,0,0,0,6,4,0,0,0,0,0,0,0,0,0,
    2,4,2384,0,6,4,8,0,11,6,8,0,0,0,0,0,0,0,0,0,0,0,0,0,
    3,5,1984,0,7,10,6,0,7,8,10,0,8,9,10,0,0,0,0,0,0,0,0,0,
    4,6,1737,0,0,7,3,0,0,10,7,0,0,9,10,0,6,7,10,0,0,0,0,0,
    4,6,1475,0,10,6,7,0,1,10,7,0,1,7,8,0,1,8,0,0,0,0,0,0,
    3,5,1226,0,10,6,7,0,10,7,1,0,1,7,3,0,0,0,0,0,0,0,0,0,
    4,6,966,0,1,2,6,0,1,6,8,0,1,8,9,0,8,6,7,0,0,0,0,0,
    5,7,719,0,2,6,9,0,2,9,1,0,6,7,9,0,0,9,3,0,7,3,9,0,
    3,5,453,0,7,8,0,0,7,0,6,0,6,0,2,0,0,0,0,0,0,0,0,0,
    2,4,204,0,7,3,2,0,6,7,2,0,0,0,0,0,0,0,0,0,0,0,0,0,
    4,8,4044,0,2,3,11,0,10,6,8,0,10,8,9,0,8,6,7,0,0,0,0,0,
    5,7,3781,0,2,0,7,0,2,7,11,0,0,9,7,0,6,7,10,0,9,10,7,0,
    5,9,3535,0,1,8,0,0,1,7,8,0,1,10,7,0,6,7,10,0,2,3,11,0,
    4,6,3270,0,11,2,1,0,11,1,7,0,10,6,1,0,6,7,1,0,0,0,0,0,
    5,7,3018,0,8,9,6,0,8,6,7,0,9,1,6,0,11,6,3,0,1,3,6,0,
    2,6,2755,0,0,9,1,0,11,6,7,0,0,0,0,0,0,0,0,0,0,0,0,0,
    4,6,2505,0,7,8,0,0,7,0,6,0,3,11,0,0,11,6,0,0,0,0,0,0,
    1,3,2240,0,7,11,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    1,3,2240,0,7,6,11,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    2,6,2505,0,3,0,8,0,11,7,6,0,0,0,0,0,0,0,0,0,0,0,0,0,
    2,6,2755,0,0,1,9,0,11,7,6,0,0,0,0,0,0,0,0,0,0,0,0,0,
    3,7,3018,0,8,1,9,0,8,3,1,0,11,7,6,0,0,0,0,0,0,0,0,0,
    2,6,3270,0,10,1,2,0,6,11,7,0,0,0,0,0,0,0,0,0,0,0,0,0,
    3,9,3535,0,1,2,10,0,3,0,8,0,6,11,7,0,0,0,0,0,0,0,0,0,
    3,7,3781,0,2,9,0,0,2,10,9,0,6,11,7,0,0,0,0,0,0,0,0,0,
    4,8,4044,0,6,11,7,0,2,10,3,0,10,8,3,0,10,9,8,0,0,0,0,0,
    2,4,204,0,7,2,3,0,6,2,7,0,0,0,0,0,0,0,0,0,0,0,0,0,
    3,5,453,0,7,0,8,0,7,6,0,0,6,2,0,0,0,0,0,0,0,0,0,0,
    3,7,719,0,2,7,6,0,2,3,7,0,0,1,9,0,0,0,0,0,0,0,0,0,
    4,6,966,0,1,6,2,0,1,8,6,0,1,9,8,0,8,7,6,0,0,0,0,0,
    3,5,1226,0,10,7,6,0,10,1,7,0,1,3,7,0,0,0,0,0,0,0,0,0,
    4,6,1475,0,10,7,6,0,1,7,10,0,1,8,7,0,1,0,8,0,0,0,0,0,
    4,6,1737,0,0,3,7,0,0,7,10,0,0,10,9,0,6,10,7,0,0,0,0,0,
    3,5,1984,0,7,6,10,0,7,10,8,0,8,10,9,0,0,0,0,0,0,0,0,0,
    2,4,2384,0,6,8,4,0,11,8,6,0,0,0,0,0,0,0,0,0,0,0,0,0,
    3,5,2137,0,3,6,11,0,3,0,6,0,0,4,6,0,0,0,0,0,0,0,0,0,
    3,7,2899,0,8,6,11,0,8,4,6,0,9,0,1,0,0,0,0,0,0,0,0,0,
    4,6,2650,0,9,4,6,0,9,6,3,0,9,3,1,0,11,3,6,0,0,0,0,0,
    3,7,3414,0,6,8,4,0,6,11,8,0,2,10,1,0,0,0,0,0,0,0,0,0,
    4,8,3167,0,1,2,10,0,3,0,11,0,0,6,11,0,0,4,6,0,0,0,0,0,
    4,8,3925,0,4,11,8,0,4,6,11,0,0,2,9,0,2,10,9,0,0,0,0,0,
    5,7,3676,0,10,9,3,0,10,3,2,0,9,4,3,0,11,3,6,0,4,6,3,0,
    3,5,348,0,8,2,3,0,8,4,2,0,4,6,2,0,0,0,0,0,0,0,0,0,
    2,4,85,0,0,4,2,0,4,6,2,0,0,0,0,0,0,0,0,0,0,0,0,0,
    4,8,863,0,1,9,0,0,2,3,4,0,2,4,6,0,4,3,8,0,0,0,0,0,
    3,5,598,0,1,9,4,0,1,4,2,0,2,4,6,0,0,0,0,0,0,0,0,0,
    4,6,1370,0,8,1,3,0,8,6,1,0,8,4,6,0,6,10,1,0,0,0,0,0,
    3,5,1107,0,10,1,0,0,10,0,6,0,6,0,4,0,0,0,0,0,0,0,0,0,
    5,7,1881,0,4,6,3,0,4,3,8,0,6,10,3,0,0,3,9,0,10,9,3,0,
    2,4,1616,0,10,9,4,0,6,10,4,0,0,0,0,0,0,0,0,0,0,0,0,0,
    2,6,2800,0,4,9,5,0,7,6,11,0,0,0,0,0,0,0,0,0,0,0,0,0,
    3,9,3065,0,0,8,3,0,4,9,5,0,11,7,6,0,0,0,0,0,0,0,0,0,
    3,7,2291,0,5,0,1,0,5,4,0,0,7,6,11,0,0,0,0,0,0,0,0,0,
    4,8,2554,0,11,7,6,0,8,3,4,0,3,5,4,0,3,1,5,0,0,0,0,0,
    3,9,3830,0,9,5,4,0,10,1,2,0,7,6,11,0,0,0,0,0,0,0,0,0,
    4,12,4095,0,6,11,7,0,1,2,10,0,0,8,3,0,4,9,5,0,0,0,0,0,
    4,8,3317,0,7,6,11,0,5,4,10,0,4,2,10,0,4,0,2,0,0,0,0,0,
    5,9,3580,0,3,4,8,0,3,5,4,0,3,2,5,0,10,5,2,0,11,7,6,0,
    3,7,764,0,7,2,3,0,7,6,2,0,5,4,9,0,0,0,0,0,0,0,0,0,
    4,8,1013,0,9,5,4,0,0,8,6,0,0,6,2,0,6,8,7,0,0,0,0,0,
    4,8,255,0,3,6,2,0,3,7,6,0,1,5,0,0,5,4,0,0,0,0,0,0,
    5,7,502,0,6,2,8,0,6,8,7,0,2,1,8,0,4,8,5,0,1,5,8,0,
    4,8,1786,0,9,5,4,0,10,1,6,0,1,7,6,0,1,3,7,0,0,0,0,0,
    5,9,2035,0,1,6,10,0,1,7,6,0,1,0,7,0,8,7,0,0,9,5,4,0,
    5,7,1273,0,4,0,10,0,4,10,5,0,0,3,10,0,6,10,7,0,3,7,10,0,
    4,6,1520,0,7,6,10,0,7,10,8,0,5,4,10,0,4,8,10,0,0,0,0,0,
    3,5,2912,0,6,9,5,0,6,11,9,0,11,8,9,0,0,0,0,0,0,0,0,0,
    4,6,2665,0,3,6,11,0,0,6,3,0,0,5,6,0,0,9,5,0,0,0,0,0,
    4,6,2403,0,0,11,8,0,0,5,11,0,0,1,5,0,5,6,11,0,0,0,0,0,
    3,5,2154,0,6,11,3,0,6,3,5,0,5,3,1,0,0,0,0,0,0,0,0,0,
    4,8,3942,0,1,2,10,0,9,5,11,0,9,11,8,0,11,5,6,0,0,0,0,0,
    5,9,3695,0,0,11,3,0,0,6,11,0,0,9,6,0,5,6,9,0,1,2,10,0,
    5,7,3429,0,11,8,5,0,11,5,6,0,8,0,5,0,10,5,2,0,0,2,5,0,
    4,6,3180,0,6,11,3,0,6,3,5,0,2,10,3,0,10,5,3,0,0,0,0,0,
    4,6,876,0,5,8,9,0,5,2,8,0,5,6,2,0,3,8,2,0,0,0,0,0,
    3,5,613,0,9,5,6,0,9,6,0,0,0,6,2,0,0,0,0,0,0,0,0,0,
    5,7,367,0,1,5,8,0,1,8,0,0,5,6,8,0,3,8,2,0,6,2,8,0,
    2,4,102,0,1,5,6,0,2,1,6,0,0,0,0,0,0,0,0,0,0,0,0,0,
    5,7,1898,0,1,3,6,0,1,6,10,0,3,8,6,0,5,6,9,0,8,9,6,0,
    4,6,1635,0,10,1,0,0,10,0,6,0,9,5,0,0,5,6,0,0,0,0,0,0,
    2,6,1385,0,0,3,8,0,5,6,10,0,0,0,0,0,0,0,0,0,0,0,0,0,
    1,3,1120,0,10,5,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    2,4,3232,0,11,5,10,0,7,5,11,0,0,0,0,0,0,0,0,0,0,0,0,0,
    3,7,3497,0,11,5,10,0,11,7,5,0,8,3,0,0,0,0,0,0,0,0,0,0,
    3,7,3747,0,5,11,7,0,5,10,11,0,1,9,0,0,0,0,0,0,0,0,0,0,
    4,8,4010,0,10,7,5,0,10,11,7,0,9,8,1,0,8,3,1,0,0,0,0,0,
    3,5,2214,0,11,1,2,0,11,7,1,0,7,5,1,0,0,0,0,0,0,0,0,0,
    4,8,2479,0,0,8,3,0,1,2,7,0,1,7,5,0,7,2,11,0,0,0,0,0,
    4,6,2725,0,9,7,5,0,9,2,7,0,9,0,2,0,2,11,7,0,0,0,0,0,
    5,7,2988,0,7,5,2,0,7,2,11,0,5,9,2,0,3,2,8,0,9,8,2,0,
    3,5,1196,0,2,5,10,0,2,3,5,0,3,7,5,0,0,0,0,0,0,0,0,0,
    4,6,1445,0,8,2,0,0,8,5,2,0,8,7,5,0,10,2,5,0,0,0,0,0,
    4,8,1711,0,9,0,1,0,5,10,3,0,5,3,7,0,3,10,2,0,0,0,0,0,
    5,7,1958,0,9,8,2,0,9,2,1,0,8,7,2,0,10,2,5,0,7,5,2,0,
    2,4,170,0,1,3,5,0,3,7,5,0,0,0,0,0,0,0,0,0,0,0,0,0,
    3,5,419,0,0,8,7,0,0,7,1,0,1,7,5,0,0,0,0,0,0,0,0,0,
    3,5,681,0,9,0,3,0,9,3,5,0,5,3,7,0,0,0,0,0,0,0,0,0,
    2,4,928,0,9,8,7,0,5,9,7,0,0,0,0,0,0,0,0,0,0,0,0,0,
    3,5,3376,0,5,8,4,0,5,10,8,0,10,11,8,0,0,0,0,0,0,0,0,0,
    4,6,3129,0,5,0,4,0,5,11,0,0,5,10,11,0,11,3,0,0,0,0,0,0,
    4,8,3891,0,0,1,9,0,8,4,10,0,8,10,11,0,10,4,5,0,0,0,0,0,
    5,7,3642,0,10,11,4,0,10,4,5,0,11,3,4,0,9,4,1,0,3,1,4,0,
    4,6,2358,0,2,5,1,0,2,8,5,0,2,11,8,0,4,5,8,0,0,0,0,0,
    5,7,2111,0,0,4,11,0,0,11,3,0,4,5,11,0,2,11,1,0,5,1,11,0,
    5,7,2869,0,0,2,5,0,0,5,9,0,2,11,5,0,4,5,8,0,11,8,5,0,
    2,6,2620,0,9,4,5,0,2,11,3,0,0,0,0,0,0,0,0,0,0,0,0,0,
    4,6,1340,0,2,5,10,0,3,5,2,0,3,4,5,0,3,8,4,0,0,0,0,0,
    3,5,1077,0,5,10,2,0,5,2,4,0,4,2,0,0,0,0,0,0,0,0,0,0,
    5,9,1855,0,3,10,2,0,3,5,10,0,3,8,5,0,4,5,8,0,0,1,9,0,
    4,6,1590,0,5,10,2,0,5,2,4,0,1,9,2,0,9,4,2,0,0,0,0,0,
    3,5,314,0,8,4,5,0,8,5,3,0,3,5,1,0,0,0,0,0,0,0,0,0,
    2,4,51,0,0,4,5,0,1,0,5,0,0,0,0,0,0,0,0,0,0,0,0,0,
    4,6,825,0,8,4,5,0,8,5,3,0,9,0,5,0,0,3,5,0,0,0,0,0,
    1,3,560,0,9,4,5,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    3,5,3728,0,4,11,7,0,4,9,11,0,9,10,11,0,0,0,0,0,0,0,0,0,
    4,8,3993,0,0,8,3,0,4,9,7,0,9,11,7,0,9,10,11,0,0,0,0,0,
    4,6,3219,0,1,10,11,0,1,11,4,0,1,4,0,0,7,4,11,0,0,0,0,0,
    5,7,3482,0,3,1,4,0,3,4,8,0,1,10,4,0,7,4,11,0,10,11,4,0,
    4,6,2710,0,4,11,7,0,9,11,4,0,9,2,11,0,9,1,2,0,0,0,0,0,
    5,9,2975,0,9,7,4,0,9,11,7,0,9,1,11,0,2,11,1,0,0,8,3,0,
    3,5,2197,0,11,7,4,0,11,4,2,0,2,4,0,0,0,0,0,0,0,0,0,0,
    4,6,2460,0,11,7,4,0,11,4,2,0,8,3,4,0,3,2,4,0,0,0,0,0,
    4,6,1692,0,2,9,10,0,2,7,9,0,2,3,7,0,7,4,9,0,0,0,0,0,
    5,7,1941,0,9,10,7,0,9,7,4,0,10,2,7,0,8,7,0,0,2,0,7,0,
    5,7,1183,0,3,7,10,0,3,10,2,0,7,4,10,0,1,10,0,0,4,0,10,0,
    2,6,1430,0,1,10,2,0,8,7,4,0,0,0,0,0,0,0,0,0,0,0,0,0,
    3,5,666,0,4,9,1,0,4,1,7,0,7,1,3,0,0,0,0,0,0,0,0,0,
    4,6,915,0,4,9,1,0,4,1,7,0,0,8,1,0,8,7,1,0,0,0,0,0,
    2,4,153,0,4,0,3,0,7,4,3,0,0,0,0,0,0,0,0,0,0,0,0,0,
    1,3,400,0,4,8,7,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    2,4,3840,0,9,10,8,0,10,11,8,0,0,0,0,0,0,0,0,0,0,0,0,0,
    3,5,3593,0,3,0,9,0,3,9,11,0,11,9,10,0,0,0,0,0,0,0,0,0,
    3,5,3331,0,0,1,10,0,0,10,8,0,8,10,11,0,0,0,0,0,0,0,0,0,
    2,4,3082,0,3,1,10,0,11,3,10,0,0,0,0,0,0,0,0,0,0,0,0,0,
    3,5,2822,0,1,2,11,0,1,11,9,0,9,11,8,0,0,0,0,0,0,0,0,0,
    4,6,2575,0,3,0,9,0,3,9,11,0,1,2,9,0,2,11,9,0,0,0,0,0,
    2,4,2309,0,0,2,11,0,8,0,11,0,0,0,0,0,0,0,0,0,0,0,0,0,
    1,3,2060,0,3,2,11,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    3,5,1804,0,2,3,8,0,2,8,10,0,10,8,9,0,0,0,0,0,0,0,0,0,
    2,4,1541,0,9,10,2,0,0,9,2,0,0,0,0,0,0,0,0,0,0,0,0,0,
    4,6,1295,0,2,3,8,0,2,8,10,0,0,1,8,0,1,10,8,0,0,0,0,0,
    1,3,1030,0,1,10,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    2,4,778,0,1,3,8,0,9,1,8,0,0,0,0,0,0,0,0,0,0,0,0,0,
    1,3,515,0,0,9,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    1,3,265,0,0,3,8,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0
]);
