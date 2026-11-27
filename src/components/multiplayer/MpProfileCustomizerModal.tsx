import {
  ProfileCustomizerModal,
  type ProfileCustomizerModalProps,
} from '../common/ProfileCustomizerModal';

export function MpProfileCustomizerModal(props: ProfileCustomizerModalProps) {
  return (
    <ProfileCustomizerModal
      title="감독 외형 · 유니폼 · 구단 커스텀"
      managerLabel="감독 닉네임 (최대 14자)"
      confirmLabel="적용 완료"
      {...props}
    />
  );
}
