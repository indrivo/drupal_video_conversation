<?php

namespace Drupal\drupal_video_conversation\Plugin\Block;

use Drupal\Core\Block\BlockBase;
use Drupal\Core\Access\AccessResult;
use Drupal\Core\Form\FormStateInterface;
use Drupal\Core\Session\AccountInterface;

/**
 * Provides an drupal Video Candidate Exam Block.
 *
 * @Block(
 *   id = "drupal_video_candidate_exam_block",
 *   admin_label = @Translation("drupal Video Candidate Exam Block"),
 *   category = @Translation("drupal Video Conversation")
 * )
 */
class drupalVideoCandidateExamBlock extends BlockBase {

  /**
   * {@inheritdoc}
   */
  public function build() {
    $renderable = [
      '#theme' => 'drupal_candidate_exam',
      '#cache' => [
        'max-age' => 0
      ]
    ];
    $rendered = \Drupal::service('renderer')->render($renderable);

    $build['content'] = [
      '#markup' => $rendered,
      '#cache' => [
        'max-age' => 0
      ]
    ];

    return $build;
  }

  /**
   * {@inheritdoc}
   */
  protected function blockAccess(AccountInterface $account) {
    return AccessResult::allowedIfHasPermission($account, 'access content');
  }

  /**
   * {@inheritdoc}
   */
  public function getCacheMaxAge() {
    return 0;
  }

}
