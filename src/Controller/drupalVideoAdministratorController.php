<?php

namespace Drupal\drupal_video_conversation\Controller;

use Drupal\Core\Controller\ControllerBase;
use Drupal\group\Entity\Group;
use Drupal\user\Entity\User;
use Symfony\Component\HttpFoundation\JsonResponse;
use Drupal\opigno_learning_path\LearningPathAccess;

/**
 * Returns responses for drupal Video Conversation routes.
 */
class drupalVideoAdministratorController extends ControllerBase {

  /**
   * __construct function
   */
  public function __construct() {
    $this->logger = \Drupal::logger('drupal_video_conversation');
    $this->group_member_ps = \Drupal::service('drupal_profile_handler.group_member_profile_service');
  }

  /**
   * Candidates Visualization Page.
   */
  public function view() {
    $renderable = [
      '#theme' => 'drupal_administrator',
    ];
    $rendered = \Drupal::service('renderer')->render($renderable);

    $response['content'] = [
      '#markup' => $rendered,
    ];
    return $response;
  }

  /**
   * storeRecord function
   *
   * @return Symfony\Component\HttpFoundation\JsonResponse
   */
  public function storeRecord() {
    $response = [];
    if ($_SERVER['REQUEST_METHOD'] != 'POST' || !isset($_FILES['files'])) {
      $message = "Unable to save video file.";
      $this->logger->warning($message . "The necessary parameter
       (KEY: files, in POST request) do not come.");
      $response['messages'][] = $message;
      $response['response'] = FALSE;
      return new JsonResponse($response);
    }
    $path = \Drupal::service('file_system')->realpath(file_default_scheme() . "://");
    $ds = DIRECTORY_SEPARATOR;

    $all_files = count($_FILES['files']['tmp_name']);
    for ($i = 0; $i < $all_files; $i++) {
      $file_name = $_FILES['files']['name'][$i];
      $file_tmp = $_FILES['files']['tmp_name'][$i];
      $file_type = $_FILES['files']['type'][$i];
      $file_size = $_FILES['files']['size'][$i];
      $file_exc_arr = explode('.', $_FILES['files']['name'][$i]);
      $file_ext = strtolower(end($file_exc_arr));
      $uniq_video_id = uniqid();

      $storage_dir = $path . $ds . 'video'. $ds . str_replace(".", "_", $file_name) . $ds;
      if (!file_exists($storage_dir)) {
        $storage_dir = mkdir($storage_dir, 0755, true) ? $storage_dir : die("Unable to create directory: $storage_dir");
      }
      $tech_file = $storage_dir . str_replace(".", "_", $file_name) . ".txt";
      $file_dir = $storage_dir . $uniq_video_id . ".$file_ext";
      $final_otput_dir = $storage_dir . $file_name;

      if (!file_exists($final_otput_dir)) {
        $mv_video_file = move_uploaded_file($file_tmp, $file_dir) ?? die('Unable to move the downloaded file');
      }

      if (!file_exists($tech_file)) {
        // Create a technical file that will contain a link to all parts of the candidate stream.
        $handle = fopen($tech_file, "w") ?? die("Unable to create file: $tech_file");
        $data = "file " . str_replace($ds, '/', $file_dir) . " \n";
        fwrite($handle, $data);
        fclose($handle);
      }
      else {
        // Append tech file with new link to chunck of candidate stream.
        $handle = fopen($tech_file, "a") ?? die("Cannot add data to file: $tech_file");
        $data = "file " . str_replace($ds, '/', $file_dir) . " \n";
        fwrite($handle, $data);
        fclose($handle);
      }
    }

    return new JsonResponse($response);
  }

  /**
   * function mergeChunks
   *
   * Notice: The purpose of the functions is to merge fragments of a candidate
   * stream in one file and attach a link to the membership.
   *
   * @return Symfony\Component\HttpFoundation\JsonResponse
   */
  public function mergeChunks() {
    $response = [];
    if (!$_POST['merge_chunks'] || !$_POST['filename']) {
      $message = "Unable to merge fragments of candidate stream.";
      $this->logger->warning($message . " Because the required parameters are missing in the POST request.
       Incoming params (merge_chunks: @merge_chunks | filename: @filename)", [
         '@merge_chunks' => $_POST['merge_chunks'],
         '@filename' => $_POST['filename'],
      ]);
      $response['messages'][] = $message;
      $response['response'] = FALSE;
      return new JsonResponse($response);
    }

    $file_name = $_POST['filename'];
    $path = \Drupal::service('file_system')->realpath(file_default_scheme() . "://");
    $ds = DIRECTORY_SEPARATOR;
    $storage_dir = $path . $ds . 'video'. $ds . str_replace(".", "_", $file_name) . $ds;
    if (!file_exists($storage_dir)) {
      $message = "Not found directory with stored stream fragments.";
      $this->logger->warning($message . '(storage_dir:@storage_dir>)', [
        '@storage_dir' => $storage_dir
      ]);
      $response['messages'][] = $message;
      $response['response'] = FALSE;
      return new JsonResponse($response);
    }

    // Concatenate the fragments in one video file.
    $tech_file = $storage_dir . str_replace(".", "_", $file_name) . ".txt";
    if (!file_exists($tech_file)) {
      $response['response'] = FALSE;
      return new JsonResponse($response);
    }

    $final_otput_dir = $storage_dir . $file_name;
    // Merge chunks in an intermediate file.
    exec("ffmpeg -f concat -safe 0 -i $tech_file -c copy $final_otput_dir");
    // Using ffmpeg we compress, convert and resize the video.
    /** @todo The line below will be temporarily commented */
    // exec("ffmpeg -i $final_otput_dir.webm -crf 51 $final_otput_dir");
    // Not necessarily, but I think that in the future there will be situations
    // when the ffmpeg tool does not have time to finish execution
    // based on this, we need to give at least 2 seconds to execute the above method.
    /** @todo The line below will be temporarily commented */
    // sleep(2);

    if (!file_exists($final_otput_dir)) {
      $message = "File fragments were not merged.";
      $this->logger->warning($message . ' (tech_file: @tech_file | final_otput_dir: @final_otput_dir).', [
        '@tech_file' => $tech_file,
        '@final_otput_dir' => $final_otput_dir
      ]);
      $response['messages'][] = $message;
      $response['response'] = FALSE;
      return new JsonResponse($response);
    }
    else {
      $tech_file_data = file_get_contents($tech_file);
      $chunk_directories = array_map(function($i) {
        return preg_replace('/\s+/', '', $i);
      }, explode('file ', $tech_file_data));
      $chunk_directories = array_values(array_filter($chunk_directories));

      foreach ($chunk_directories as $chunk_dir) {
        if (!unlink($chunk_dir)) {
          continue;
        }
      }
    }

    // Delete technical file.
    unlink($tech_file);
    // Delete the intermediate unformatted file.
    /** @todo The line below will be temporarily commented */
    // unlink("$final_otput_dir.webm");

    // Attach the video link to the membership.
    if (!$_POST['uid'] || !$_POST['gid']) {
      $message = "Cannot attach video link to membership.";
      $this->logger->warning($message . ' Important input parameters(uid: @uid | gid: @gid)', [
        '@uid' => $_POST['uid'],
        '@gid' => $_POST['gid'],
      ]);

      $response['messages'][] = $message;
      $response['response'] = FALSE;
      return new JsonResponse($response);
    }

    $public_file_dir = substr($final_otput_dir, strpos($final_otput_dir, 'sites'), strlen($final_otput_dir));
    $response['file_attach'] = self::attachLink($_POST['uid'], $_POST['gid'], $public_file_dir);
    return new JsonResponse($response);
  }

  /**
   * attachLink function
   *
   * Notice: will be responsible for attaching the video file to the membership profile.
   *
   * @param string $uid
   * @param string $gid
   * @param string $file_dir
   *
   * @return boolean $response
   */
  public function attachLink($uid, $gid, $file_dir) {
    $uid = (int)$uid;
    $gid = (int)$gid;
    if (!$uid || !$gid || !$file_dir) {
      $this->logger->warning("Is impossible to attach video link to membership.
       Incoming params (uid: @uid | gid: @gid | file_dir: @file_dir)", [
        '@uid' => $uid,
        '@gid' => $gid,
        '@file_dir' => $file_dir
      ]);
      return FALSE;
    }

    $group = Group::load($gid);
    if (!$group) {
      $this->logger->warning('Is impossible to attach video link because not found
        group entry. Incoming params (gid:@gid).', [
        '@gid' => $gid,
      ]);
      return FALSE;
    }

    $account = User::load($uid);
    if (!$account) {
      $this->logger->warning('Is impossible to attach video link because no user
        account entry was found. Incoming params (uid:@uid).', [
        '@uid' => $uid,
      ]);
      return FALSE;
    }

    $membership = $this->group_member_ps->loadMembership($group, $account, $last = TRUE);
    if (!$membership) {
      $this->logger->warning('Is impossible to attach video link because not found
        memberships. (gid:@gid | username:@username uid:@uid)', [
        '@gid' => $gid,
        '@uid' => $uid,
        '@username' => $account->getEmail(),
      ]);
      return FALSE;
    }
    $membership = $membership->getGroupContent();
    if (!$membership->hasField('field_video')) {
      $this->logger->warning('Is impossible to attach video file, because selected
        membership (mid:@mid | uid:@uid | gid:@gid) not contain field "field_video".', [
        '@mid' => $membership->id(),
        '@uid' => $account->id(),
        '@gid' => $group->id(),
      ]);
      return FALSE;
    }

    $exist_video_links = $membership->get('field_video')->getValue();
    $s = DIRECTORY_SEPARATOR;
    $new_link = [
      'uri' => $GLOBALS['base_url'] . $s . $file_dir,
      'title' => date("m.d.y_H:i:s"),
      'options' => []
    ];
    // Insert new item in existing video links.
    $exist_video_links[] = $new_link;
    $membership->set('field_video', $exist_video_links);

    if ($membership->save()) {
      $this->logger->notice(
        'The video has been attached to the member ("@group_label" | gid:@gid
        | @username | uid:@uid | member_id:@mid).', [
        '@group_label' => $group->label(),
        '@gid' => $group->id(),
        '@username' => $account->getUsername(),
        '@uid' => $account->id(),
        '@mid' => $membership->id(),
      ]);
      return TRUE;
    }
    else {
      $this->logger->warning(
        'The video was not attached to the member ("@group_label" | gid:@gid
        | @username | uid:@uid | member_id:@mid).', [
        '@group_label' => $group->label(),
        '@gid' => $gid,
        '@username' => $account->getUsername(),
        '@uid' => $account->id(),
        '@mid' => $membership->id(),
      ]);
      return FALSE;
    }
  }

  /**
   * logging function
   *
   * @return Symfony\Component\HttpFoundation\JsonResponse
   */
  public function logging() {
    $response = [];
    $message = $_POST['log_message'];
    if (!$message) {
      $response['response'] = FALSE;
      return new JsonResponse($response);
    }

    $this->logger->notice($message);
    $response['response'] = TRUE;
    return new JsonResponse($response);
  }

  /**
   * function ban.
   *
   * @return Symfony\Component\HttpFoundation\JsonResponse
   */
  public function ban() {
    if (!$_POST['ban']) {
      return new JsonResponse(['status' => FALSE]);
    }

    // Prepare broadcaster extra object.
    $extra = [];
    foreach ($_POST as $key => $value) {
      if ($key != 'ban') {
        $extra[$key] = $value;
      }
    }

    // Change member's validation status to "Removed".
    if (!$extra['gid'] || !$extra['uid']) {
      $this->logger->warning('To perform the function "ban" both parameters are required.'
      . ' Incoming params (uid: @uid | gid: @gid)', [
        '@uid' => $extra['uid'],
        '@gid' => $extra['gid'],
      ]);
      return new JsonResponse(['status' => FALSE]);
    }
    $group = Group::load($extra['gid']);
    if (!$group) {
      $this->logger->warning('No "Group" object found with group id (@gid)', [
        '@gid' => $extra['gid'],
      ]);
      return new JsonResponse(['status' => FALSE]);
    }

    $user = User::load($extra['uid']);
    if (!$user) {
      $this->logger->warning('No "User" object found with user id (@uid)', [
        '@uid' => $extra['uid'],
      ]);
      return new JsonResponse(['status' => FALSE]);
    }

    $membership = $this->group_member_ps->loadMembership($group, $user);
    if (!$membership) {
      $this->logger->warning('No "Member" entry found with incoming params (uid: @uid | gid: @gid).', [
        '@uid' => $extra['uid'],
        '@gid' => $extra['gid'],
      ]);
      return new JsonResponse(['status' => FALSE]);
    }

    $statuses = LearningPathAccess::getMembershipStatusesArray();
    $status = array_search(t('Removed'), $statuses) ?? 5;
    $this->group_member_ps->setMemberValidationStatus($membership->getGroupContent(), $status);

    $new_member_validation_status = $this->group_member_ps->member_validation_status($membership);
    if ($new_member_validation_status == t('Removed')) {
      $this->logger->warning('(@user_email | uid: @uid | gid: @gid) Status of'
      .' member was changed in "@status" (uid: @uid | gid: @gid).', [
        '@user_email' => $user->getEmail(),
        '@status' => $statuses[$status],
        '@uid' => $extra['uid'],
        '@gid' => $extra['gid'],
      ]);
      return new JsonResponse(['status' => TRUE]);
    }
    else {
      return new JsonResponse(['status' => FALSE]);
    }
  }

}
