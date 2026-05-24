import { shouldTripCriticalCircuitBreaker } from '../src/circuit-breaker.js'

console.log('Test 1:', shouldTripCriticalCircuitBreaker('bash', "bash -c 'echo ok; rm -rf .'"))