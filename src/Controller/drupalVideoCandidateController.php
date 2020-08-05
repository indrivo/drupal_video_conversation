<?php

namespace Drupal\drupal_video_conversation\Controller;

use Drupal\Core\Controller\ControllerBase;

/**
 * Returns responses for drupal Video Conversation routes.
 */
class drupalVideoCandidateController extends ControllerBase {

  /**
   * Custom method, created at period of development.
   */
  public function view() {
    $renderable = [
      '#theme' => 'drupal_candidate',
    ];
    $rendered = \Drupal::service('renderer')->render($renderable);

    $response['content'] = [
      '#markup' => $rendered,
    ];
    return $response;
  }

}
