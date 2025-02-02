/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 * @flow
 */
import {AbstractCrudObject} from './../abstract-crud-object';
import AbstractObject from './../abstract-object';
import Cursor from './../cursor';
import CatalogItemChannelsToIntegrityStatus from './catalog-item-channels-to-integrity-status';

/**
 * JobsJob
 * @extends AbstractCrudObject
 * @see {@link https://developers.facebook.com/docs/marketing-api/}
 */
export default class JobsJob extends AbstractCrudObject {
  static get Fields (): Object {
    return Object.freeze({
      address: 'address',
      applinks: 'applinks',
      category_specific_fields: 'category_specific_fields',
      custom_label_0: 'custom_label_0',
      custom_label_1: 'custom_label_1',
      custom_label_2: 'custom_label_2',
      custom_label_3: 'custom_label_3',
      custom_label_4: 'custom_label_4',
      custom_label_5: 'custom_label_5',
      custom_label_6: 'custom_label_6',
      custom_number_0: 'custom_number_0',
      custom_number_1: 'custom_number_1',
      custom_number_2: 'custom_number_2',
      custom_number_3: 'custom_number_3',
      custom_number_4: 'custom_number_4',
      custom_number_5: 'custom_number_5',
      custom_number_6: 'custom_number_6',
      id: 'id',
      image_fetch_status: 'image_fetch_status',
      images: 'images',
      jobs_job_id: 'jobs_job_id',
      sanitized_images: 'sanitized_images',
      unit_price: 'unit_price',
      url: 'url',
      visibility: 'visibility',
    });
  }

  static get ImageFetchStatus (): Object {
    return Object.freeze({
      direct_upload: 'DIRECT_UPLOAD',
      fetched: 'FETCHED',
      fetch_failed: 'FETCH_FAILED',
      no_status: 'NO_STATUS',
      outdated: 'OUTDATED',
      partial_fetch: 'PARTIAL_FETCH',
    });
  }
  static get Visibility (): Object {
    return Object.freeze({
      published: 'PUBLISHED',
      staging: 'STAGING',
    });
  }

  getAugmentedRealitiesMetadata (fields: Array<string>, params: Object = {}, fetchFirstPage: boolean = true): Cursor | Promise<*> {
    return this.getEdge(
      AbstractObject,
      fields,
      params,
      fetchFirstPage,
      '/augmented_realities_metadata'
    );
  }

  getChannelsToIntegrityStatus (fields: Array<string>, params: Object = {}, fetchFirstPage: boolean = true): Cursor | Promise<*> {
    return this.getEdge(
      CatalogItemChannelsToIntegrityStatus,
      fields,
      params,
      fetchFirstPage,
      '/channels_to_integrity_status'
    );
  }

  getVideosMetadata (fields: Array<string>, params: Object = {}, fetchFirstPage: boolean = true): Cursor | Promise<*> {
    return this.getEdge(
      AbstractObject,
      fields,
      params,
      fetchFirstPage,
      '/videos_metadata'
    );
  }

  
  get (fields: Array<string>, params: Object = {}): JobsJob {
    // $FlowFixMe : Support Generic Types
    return this.read(
      fields,
      params
    );
  }
}
