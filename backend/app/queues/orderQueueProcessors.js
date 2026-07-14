import {
  sellerTimeoutQueue,
  deliveryTimeoutQueue,
  returnPickupTimeoutQueue,
  rescheduleQueue,
  shiprocketQueue,
  JOB_NAMES,
} from "./orderQueues.js";
import {
  processSellerTimeoutJob,
  processDeliveryTimeoutJob,
  processReturnPickupTimeoutJob,
  processOrderRescheduleJob,
} from "../services/orderWorkflowService.js";
import Order from "../models/order.js";
import SellerProductRequest from "../models/sellerProductRequest.js";
import User from "../models/customer.js";
import { createShipRocketOrder, createShipRocketOrderForRequest } from "../../utils/shipRocketService.js";
import { isRedisEnabled } from "../config/redis.js";
import logger from "../services/logger.js";
import { incrementCounter, recordHistogram } from "../services/metrics.js";

export function registerOrderQueueProcessors() {
  if (!isRedisEnabled()) {
    logger.info('Redis disabled, skipping queue processor registration');
    return;
  }

  // Seller timeout queue processor
  sellerTimeoutQueue.process(JOB_NAMES.SELLER_TIMEOUT, async (job) => {
    const startTime = Date.now();
    
    try {
      logger.info('Processing seller timeout job', {
        jobId: job.id,
        jobType: JOB_NAMES.SELLER_TIMEOUT,
        orderId: job.data.orderId,
        attempt: job.attemptsMade + 1
      });
      
      await processSellerTimeoutJob(job.data);
      
      const duration = Date.now() - startTime;
      
      logger.info('Seller timeout job completed', {
        jobId: job.id,
        jobType: JOB_NAMES.SELLER_TIMEOUT,
        orderId: job.data.orderId,
        duration
      });
      
      // Collect metrics
      incrementCounter('queue_jobs_total', {
        queue: 'seller-timeout',
        status: 'completed'
      });
      recordHistogram('queue_job_duration_seconds', duration / 1000, {
        queue: 'seller-timeout'
      });
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error('Seller timeout job failed', {
        jobId: job.id,
        jobType: JOB_NAMES.SELLER_TIMEOUT,
        orderId: job.data.orderId,
        attempt: job.attemptsMade + 1,
        duration,
        error: error.message,
        stack: error.stack
      });
      
      // Collect metrics
      incrementCounter('queue_jobs_total', {
        queue: 'seller-timeout',
        status: 'failed'
      });
      
      throw error; // Re-throw to let Bull handle retry
    }
  });

  // Delivery timeout queue processor
  deliveryTimeoutQueue.process(JOB_NAMES.DELIVERY_TIMEOUT, async (job) => {
    const startTime = Date.now();
    
    try {
      logger.info('Processing delivery timeout job', {
        jobId: job.id,
        jobType: JOB_NAMES.DELIVERY_TIMEOUT,
        orderId: job.data.orderId,
        attempt: job.attemptsMade + 1
      });
      
      await processDeliveryTimeoutJob(job.data);
      
      const duration = Date.now() - startTime;
      
      logger.info('Delivery timeout job completed', {
        jobId: job.id,
        jobType: JOB_NAMES.DELIVERY_TIMEOUT,
        orderId: job.data.orderId,
        duration
      });
      
      // Collect metrics
      incrementCounter('queue_jobs_total', {
        queue: 'delivery-timeout',
        status: 'completed'
      });
      recordHistogram('queue_job_duration_seconds', duration / 1000, {
        queue: 'delivery-timeout'
      });
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error('Delivery timeout job failed', {
        jobId: job.id,
        jobType: JOB_NAMES.DELIVERY_TIMEOUT,
        orderId: job.data.orderId,
        attempt: job.attemptsMade + 1,
        duration,
        error: error.message,
        stack: error.stack
      });
      
      // Collect metrics
      incrementCounter('queue_jobs_total', {
        queue: 'delivery-timeout',
        status: 'failed'
      });
      
      throw error; // Re-throw to let Bull handle retry
    }
  });

  // Return-pickup timeout queue processor — same shape as delivery timeout.
  returnPickupTimeoutQueue.process(JOB_NAMES.RETURN_PICKUP_TIMEOUT, async (job) => {
    const startTime = Date.now();

    try {
      logger.info('Processing return-pickup timeout job', {
        jobId: job.id,
        jobType: JOB_NAMES.RETURN_PICKUP_TIMEOUT,
        orderId: job.data.orderId,
        attempt: job.attemptsMade + 1,
      });

      await processReturnPickupTimeoutJob(job.data);

      const duration = Date.now() - startTime;

      logger.info('Return-pickup timeout job completed', {
        jobId: job.id,
        jobType: JOB_NAMES.RETURN_PICKUP_TIMEOUT,
        orderId: job.data.orderId,
        duration,
      });

      incrementCounter('queue_jobs_total', {
        queue: 'return-pickup-timeout',
        status: 'completed',
      });
      recordHistogram('queue_job_duration_seconds', duration / 1000, {
        queue: 'return-pickup-timeout',
      });
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error('Return-pickup timeout job failed', {
        jobId: job.id,
        jobType: JOB_NAMES.RETURN_PICKUP_TIMEOUT,
        orderId: job.data.orderId,
        attempt: job.attemptsMade + 1,
        duration,
        error: error.message,
        stack: error.stack,
      });

      incrementCounter('queue_jobs_total', {
        queue: 'return-pickup-timeout',
        status: 'failed',
      });

      throw error;
    }
  });

  // Queue event handlers
  sellerTimeoutQueue.on("failed", (job, err) => {
    logger.error('Seller timeout queue job failed', {
      jobId: job?.id,
      jobType: JOB_NAMES.SELLER_TIMEOUT,
      orderId: job?.data?.orderId,
      error: err?.message
    });
  });
  
  deliveryTimeoutQueue.on("failed", (job, err) => {
    logger.error('Delivery timeout queue job failed', {
      jobId: job?.id,
      jobType: JOB_NAMES.DELIVERY_TIMEOUT,
      orderId: job?.data?.orderId,
      error: err?.message
    });
  });
  
  sellerTimeoutQueue.on("completed", (job) => {
    logger.debug('Seller timeout queue job completed', {
      jobId: job?.id,
      orderId: job?.data?.orderId
    });
  });
  
  deliveryTimeoutQueue.on("completed", (job) => {
    logger.debug('Delivery timeout queue job completed', {
      jobId: job?.id,
      orderId: job?.data?.orderId
    });
  });

  returnPickupTimeoutQueue.on("failed", (job, err) => {
    logger.error('Return-pickup timeout queue job failed', {
      jobId: job?.id,
      jobType: JOB_NAMES.RETURN_PICKUP_TIMEOUT,
      orderId: job?.data?.orderId,
      error: err?.message,
    });
  });

  returnPickupTimeoutQueue.on("completed", (job) => {
    logger.debug('Return-pickup timeout queue job completed', {
      jobId: job?.id,
      orderId: job?.data?.orderId,
    });
  });

  // Reschedule queue processor
  rescheduleQueue.process(JOB_NAMES.ORDER_RESCHEDULE, async (job) => {
    const startTime = Date.now();
    try {
      logger.info('Processing order reschedule job', {
        jobId: job.id,
        jobType: JOB_NAMES.ORDER_RESCHEDULE,
        orderId: job.data.orderId,
        attempt: job.attemptsMade + 1
      });
      
      await processOrderRescheduleJob(job.data);
      
      const duration = Date.now() - startTime;
      logger.info('Order reschedule job completed', {
        jobId: job.id,
        jobType: JOB_NAMES.ORDER_RESCHEDULE,
        orderId: job.data.orderId,
        duration
      });
      
      incrementCounter('queue_jobs_total', { queue: 'order-reschedule', status: 'completed' });
      recordHistogram('queue_job_duration_seconds', duration / 1000, { queue: 'order-reschedule' });
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Order reschedule job failed', {
        jobId: job.id,
        jobType: JOB_NAMES.ORDER_RESCHEDULE,
        orderId: job.data.orderId,
        attempt: job.attemptsMade + 1,
        duration,
        error: error.message,
        stack: error.stack
      });
      
      incrementCounter('queue_jobs_total', { queue: 'order-reschedule', status: 'failed' });
      throw error;
    }
  });

  rescheduleQueue.on("failed", (job, err) => {
    logger.error('Order reschedule queue job failed', {
      jobId: job?.id,
      jobType: JOB_NAMES.ORDER_RESCHEDULE,
      orderId: job?.data?.orderId,
      error: err?.message,
    });
  });

  rescheduleQueue.on("completed", (job) => {
    logger.debug('Order reschedule queue job completed', {
      jobId: job?.id,
      orderId: job?.data?.orderId,
    });
  });

  // Shiprocket shipment creation queue processor
  shiprocketQueue.process(JOB_NAMES.SHIPROCKET_CREATE, async (job) => {
    const startTime = Date.now();
    const { type, id } = job.data;
    
    try {
      logger.info('Processing Shiprocket creation job', {
        jobId: job.id,
        jobType: JOB_NAMES.SHIPROCKET_CREATE,
        id,
        type,
        attempt: job.attemptsMade + 1
      });
      
      if (type === "ORDER") {
        const order = await Order.findById(id).populate("seller");
        if (!order) throw new Error(`Order ${id} not found`);
        const user = await User.findById(order.customer).lean();
        await createShipRocketOrder(order, user || {}, order.address, order.seller, order.items);
      } else if (type === "REQUEST") {
        const request = await SellerProductRequest.findById(id).populate("sellerId");
        if (!request) throw new Error(`Request ${id} not found`);
        const seller = request.sellerId;
        await createShipRocketOrderForRequest(request, seller, request.items);
      }
      
      const duration = Date.now() - startTime;
      logger.info('Shiprocket creation job completed', {
        jobId: job.id,
        jobType: JOB_NAMES.SHIPROCKET_CREATE,
        id,
        type,
        duration
      });
      
      incrementCounter('queue_jobs_total', { queue: 'shiprocket', status: 'completed' });
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Shiprocket creation job failed', {
        jobId: job.id,
        jobType: JOB_NAMES.SHIPROCKET_CREATE,
        id,
        type,
        attempt: job.attemptsMade + 1,
        duration,
        error: error.message,
        stack: error.stack
      });
      
      // If all attempts are exhausted, update status to failed
      const maxAttempts = job.opts.attempts || 5;
      if (job.attemptsMade + 1 >= maxAttempts) {
        logger.error(`Shiprocket creation job exhausted all retries (${maxAttempts}). Flagging as SHIPMENT_FAILED.`);
        if (type === "ORDER") {
          await Order.updateOne({ _id: id }, { $set: { "shipRocketDetails.status": "SHIPMENT_FAILED" } });
        } else if (type === "REQUEST") {
          await SellerProductRequest.updateOne({ _id: id }, { $set: { "shipRocketDetails.status": "SHIPMENT_FAILED" } });
        }
      }
      
      incrementCounter('queue_jobs_total', { queue: 'shiprocket', status: 'failed' });
      throw error;
    }
  });

  shiprocketQueue.on("failed", (job, err) => {
    logger.error('Shiprocket creation queue job failed permanently or retry scheduled', {
      jobId: job?.id,
      jobType: JOB_NAMES.SHIPROCKET_CREATE,
      id: job?.data?.id,
      error: err?.message,
    });
  });

  shiprocketQueue.on("completed", (job) => {
    logger.debug('Shiprocket creation queue job completed successfully', {
      jobId: job?.id,
      id: job?.data?.id,
    });
  });

  logger.info('Order queue processors registered', {
    queues: [
      JOB_NAMES.SELLER_TIMEOUT,
      JOB_NAMES.DELIVERY_TIMEOUT,
      JOB_NAMES.RETURN_PICKUP_TIMEOUT,
      JOB_NAMES.ORDER_RESCHEDULE,
      JOB_NAMES.SHIPROCKET_CREATE,
    ]
  });
}
