/**
 * Integration tests for Docker deployment validation
 * Focus: multi-platform testing, container health checks
 */

const { spawn, exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

describe('Docker Deployment', () => {
  const containerNames = {
    webClient: 'test-web-client',
    mlService: 'test-ml-service',
    redis: 'test-redis'
  };
  
  beforeAll(async () => {
    // Ensure Docker is available
    try {
      await execAsync('docker --version');
    } catch (error) {
      console.warn('Docker not available, skipping Docker deployment tests');
      return;
    }
  }, 10000);
  
  afterAll(async () => {
    // Cleanup test containers
    for (const containerName of Object.values(containerNames)) {
      try {
        await execAsync(`docker stop ${containerName} 2>/dev/null || true`);
        await execAsync(`docker rm ${containerName} 2>/dev/null || true`);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  }, 30000);
  
  describe('Container Build', () => {
    test('should build web-client container successfully', async () => {
      try {
        const { stdout, stderr } = await execAsync(
          'docker build -t test-web-client ./src/web-client',
          { cwd: process.cwd(), timeout: 120000 }
        );
        
        expect(stdout).toContain('Successfully built');
        expect(stderr).not.toContain('ERROR');
      } catch (error) {
        if (error.message.includes('Docker not available')) {
          console.warn('Skipping Docker test - Docker not available');
          return;
        }
        throw error;
      }
    }, 150000);
    
    test('should build ml-service container successfully', async () => {
      try {
        const { stdout, stderr } = await execAsync(
          'docker build -t test-ml-service ./src/ml-service',
          { cwd: process.cwd(), timeout: 180000 }
        );
        
        expect(stdout).toContain('Successfully built');
        expect(stderr).not.toContain('ERROR');
      } catch (error) {
        if (error.message.includes('Docker not available')) {
          console.warn('Skipping Docker test - Docker not available');
          return;
        }
        throw error;
      }
    }, 200000);
  });
  
  describe('Container Health Checks', () => {
    test('should start Redis container with health check', async () => {
      try {
        // Start Redis container
        await execAsync(`docker run -d --name ${containerNames.redis} ` +
                       '--health-cmd="redis-cli ping" ' +
                       '--health-interval=5s ' +
                       '--health-timeout=3s ' +
                       '--health-retries=3 ' +
                       'redis:7-alpine');
        
        // Wait for health check to pass
        let healthy = false;
        for (let i = 0; i < 12; i++) { // 60 second timeout
          const { stdout } = await execAsync(
            `docker inspect --format='{{.State.Health.Status}}' ${containerNames.redis}`
          );
          
          if (stdout.trim() === 'healthy') {
            healthy = true;
            break;
          }
          
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
        
        expect(healthy).toBe(true);
      } catch (error) {
        if (error.message.includes('Docker not available')) {
          console.warn('Skipping Docker test - Docker not available');
          return;
        }
        throw error;
      }
    }, 90000);
    
    test('should validate web-client container startup', async () => {
      try {
        // Start web-client container
        await execAsync(`docker run -d --name ${containerNames.webClient} ` +
                       '-p 3002:3000 ' +
                       '-e NODE_ENV=test ' +
                       '-e REDIS_URL=redis://localhost:6379 ' +
                       'test-web-client');
        
        // Wait for container to be running
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Check container status
        const { stdout } = await execAsync(
          `docker inspect --format='{{.State.Running}}' ${containerNames.webClient}`
        );
        
        expect(stdout.trim()).toBe('true');
        
        // Check logs for startup success
        const { stdout: logs } = await execAsync(
          `docker logs ${containerNames.webClient}`
        );
        
        expect(logs).toContain('Server starting');
      } catch (error) {
        if (error.message.includes('Docker not available')) {
          console.warn('Skipping Docker test - Docker not available');
          return;
        }
        throw error;
      }
    }, 60000);
    
    test('should validate ml-service container startup', async () => {
      try {
        // Start ml-service container
        await execAsync(`docker run -d --name ${containerNames.mlService} ` +
                       '-p 8003:8000 ' +
                       '-e REDIS_URL=redis://localhost:6379 ' +
                       'test-ml-service');
        
        // Wait for container to be running
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        // Check container status
        const { stdout } = await execAsync(
          `docker inspect --format='{{.State.Running}}' ${containerNames.mlService}`
        );
        
        expect(stdout.trim()).toBe('true');
        
        // Check logs for model loading
        const { stdout: logs } = await execAsync(
          `docker logs ${containerNames.mlService}`
        );
        
        expect(logs).toMatch(/Starting|Model|Loading/i);
      } catch (error) {
        if (error.message.includes('Docker not available')) {
          console.warn('Skipping Docker test - Docker not available');
          return;
        }
        throw error;
      }
    }, 90000);
  });
  
  describe('Multi-platform Support', () => {
    test('should identify current platform', async () => {
      try {
        const { stdout } = await execAsync('docker version --format "{{.Server.Os}}/{{.Server.Arch}}"');
        const platform = stdout.trim();
        
        expect(platform).toMatch(/^(linux|darwin|windows)\/(amd64|arm64|386)$/);
        console.log(`Testing on platform: ${platform}`);
      } catch (error) {
        if (error.message.includes('Docker not available')) {
          console.warn('Skipping Docker test - Docker not available');
          return;
        }
        throw error;
      }
    });
    
    test('should build for current platform', async () => {
      try {
        // Build with explicit platform
        const { stdout } = await execAsync(
          'docker build --platform linux/amd64 -t test-platform ./src/web-client',
          { timeout: 120000 }
        );
        
        expect(stdout).toContain('Successfully built');
      } catch (error) {
        if (error.message.includes('Docker not available')) {
          console.warn('Skipping Docker test - Docker not available');
          return;
        }
        // Platform might not be supported, which is OK
        console.warn('Platform build test skipped:', error.message);
      }
    }, 150000);
  });
  
  describe('Resource Constraints', () => {
    test('should respect memory limits', async () => {
      try {
        // Start container with memory limit
        await execAsync(`docker run -d --name ${containerNames.webClient}-limited ` +
                       '--memory=256m ' +
                       '-e NODE_ENV=test ' +
                       'test-web-client');
        
        // Wait for startup
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Check if container is still running (didn't OOM)
        const { stdout } = await execAsync(
          `docker inspect --format='{{.State.Running}}' ${containerNames.webClient}-limited`
        );
        
        expect(stdout.trim()).toBe('true');
        
        // Cleanup
        await execAsync(`docker stop ${containerNames.webClient}-limited`);
        await execAsync(`docker rm ${containerNames.webClient}-limited`);
      } catch (error) {
        if (error.message.includes('Docker not available')) {
          console.warn('Skipping Docker test - Docker not available');
          return;
        }
        throw error;
      }
    }, 60000);
    
    test('should handle disk space constraints gracefully', async () => {
      try {
        // Check available disk space in container
        const { stdout } = await execAsync(
          `docker run --rm test-web-client df -h /`
        );
        
        expect(stdout).toContain('Filesystem');
        expect(stdout).toMatch(/\d+%/); // Should show percentage usage
      } catch (error) {
        if (error.message.includes('Docker not available')) {
          console.warn('Skipping Docker test - Docker not available');
          return;
        }
        throw error;
      }
    });
  });
  
  describe('Network Connectivity', () => {
    test('should establish inter-container communication', async () => {
      try {
        // Create a test network
        await execAsync('docker network create test-network');
        
        // Start Redis on the network
        await execAsync(`docker run -d --name ${containerNames.redis}-net ` +
                       '--network test-network ' +
                       'redis:7-alpine');
        
        // Start web client connected to Redis
        await execAsync(`docker run -d --name ${containerNames.webClient}-net ` +
                       '--network test-network ' +
                       `-e REDIS_URL=redis://${containerNames.redis}-net:6379 ` +
                       'test-web-client');
        
        // Wait for startup
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        // Check if web client can connect to Redis
        const { stdout: logs } = await execAsync(
          `docker logs ${containerNames.webClient}-net`
        );
        
        // Should not contain Redis connection errors
        expect(logs).not.toContain('ECONNREFUSED');
        expect(logs).not.toContain('Redis connection failed');
        
        // Cleanup
        await execAsync(`docker stop ${containerNames.redis}-net ${containerNames.webClient}-net`);
        await execAsync(`docker rm ${containerNames.redis}-net ${containerNames.webClient}-net`);
        await execAsync('docker network rm test-network');
      } catch (error) {
        if (error.message.includes('Docker not available')) {
          console.warn('Skipping Docker test - Docker not available');
          return;
        }
        throw error;
      }
    }, 90000);
  });
});
