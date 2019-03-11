  
const fs = require('fs');
const {errorLog} = require('../utils/tool')
const isDev = process.env.ELECTRON_ENV == 'development'


class fsDataService{
  constructor(filePath){
    this.resourceUri = filePath;
    this.cachData = null;
  }

  readData(key){
    const promise = this.cachData ? 
      Promise.resolve(this.cachData) 
      :
      new Promise((res,rej)=>{
        fs.readFile(this.resourceUri,'utf8',(err,raw)=>{
            if(err){
              errorLog(err)
              return rej(err)
            }
            
            try{
              const data = JSON.parse(raw);
              this.cachData = data;
              res(data)
            }catch(e){
              return rej(e)
            }
          })
        });
    if(!!key && typeof key == 'string'){
      let keys = key.split('.');
      return promise.then(result=>{
        while(keys.length && result && typeof result === 'object'){
          result = result(keys.shift())
        }
        return result
      })
    }else{
      return promise
    }
    
  }

  writeData(data){
    return new Promise((res,rej)=>{
      fs.writeFile(this.resourceUri,JSON.stringify(data),'utf8',err=>{
          if(err){
            errorLog(err)
            return rej(err)
          }
          this.cachData = data;
          res(data)
        })
      })
  }
}


class storageService{
  constructor(storage){
    this.storage = storage;
    let rawData = storage.getItem('__wbdm_lottery__');
    try{
      this.cachData = JSON.parse(rawData)
    }catch(e){
      this.cachData = {};
      storage.setItem('__wbdm_lottery__',JSON.stringify({}));
    }
  }
  readData(key){
    
  }

  writeData(data){
  }
}

class User{
  constructor({name,sex,id=User._id++}){
    this.id = id;
    this.name = name;
    this.sex = sex;
  }
  modify({name,id,sex}){
    if(!!name)
    this.name = name;
    if(sex == 0 || sex==1 || sex==-1)
    this.sex = sex
    if(!!id){
      this.id = id;
    }
  }
  get value(){
    const _this = this;
    return {
      id:_this.id,
      name:_this.name,
      sex:_this.sex
    }
  }
}
User._id = 0;


class Prize{
  constructor({name,des,total,id,color="#FFB700",result=[]}){
    this.id = isNaN(id) ? Prize._id++ : id
    this.name = name;
    this.des = des;
    this.total = total;
    this.result  = result;
    this.color = color;
  }
  reset(){
    this.result = [];
  }
  draw(user){
    this.result.push(user)
  }
  modify({name,des,total,color}){
    this.name = name;
    this.des = des;
    this.total = total;
    this.color = color;
    this.result = [];
  }
  get complete(){
    return this.result.length === this.total
  }
  get value(){
    const _this = this;
    return {
      id:_this.id,
      name:_this.name,
      des:_this.des,
      total:_this.total,
      result:_this.result.map(r=>r && r.value),
      color:_this.color
    }
  }
}
Prize._id = 0;


class LotteryService{
  constructor(service){
    this.dataSaveService = service; 
    this.prizes = [];
    this.users = [];
    this.hasChoosed = {};
    
  }

  getLotteryData(){
    return this.dataSaveService.readData()
      .then(({users,prizes,nextPID,nextUID})=>{
        User._id = nextUID || 0;
        Prize._id = nextPID || 0;
        users.forEach(u=>this.registerUser(u));
        prizes.forEach(p=>this.registerPrize(Object.assign(p,{result:p.result.map(r=>this.getUserById(r))})));
        this.computedChoosed();
        return {
          users,
          prizes:prizes.map(p=>{
            if(!p.color){
              p.color = '#FFB700';
            }
            return p
          })
        }
      })
      .catch(e=>{
        errorLog(e);
        return this.mockData()
      })
  }

  get _prizeIndex(){
    for(const i in this.prizes){
      const cur = this.prizes[i];
      if(!cur.result.length  || cur.result.length < cur.total){
        return i
      }
    }
    return -1
  }
  get _currentPrize(){
    return this.prizes[this._prizeIndex] || null
  }
  getUserById(user){
    return this.users.find(u=>u.id == user.id)
  }
  isChoosed(user){
    return this.hasChoosed[user.id+'_'+user.name]
  }
  mockPrizes(){
    const defaultsPrizes = [
      {
        name:'三等奖',
        des:'三等奖描述',
        total:10,
        color:'#FFB700'
      },
      {
        name:'二等奖',
        des:'二等奖描述',
        total:5,
        color:'#FFB700'
      },
      {
        name:'一等奖',
        des:'一等奖描述',
        total:1,
        color:'#FFB700'
      },
    ];
    this.prizes = [];
    this.hasChoosed = {}
    defaultsPrizes.forEach(p=>{
      this.registerPrize(new Prize(p));
    })
  }
  resetPrizes(){
    this.mockPrizes()
    return this.saveData().then(({prizes})=>prizes) 
  } 
  clearPrizes(){
    this.prizes.forEach(p=>{
      p.result = [];
    })
    this.hasChoosed = {};
    return this.saveData().then(({prizes})=>prizes) 
  }


  resetPrize(prizeId){
    
    const prize = this.prizes.find(p=>p.id==prizeId);

    if(!!prize){
      prize.reset()
      this.computedChoosed();
      return this.saveData().then(({prizes})=>prizes) 
    }
    return this.getData().then(({prizes})=>prizes)
  }

  getKey(user){
    return user.id+'_'+user.name
  }

  computedChoosed(){
    this.hasChoosed = {};
    this.prizes.forEach(p=>{
      // if(!p.complete){
        for(const u of p.result){
          this.hasChoosed[this.getKey(u)] = p.color;
        }
      // }
    })
  }
  registerUser(user){
    if(!(user instanceof User) && typeof user == 'object' && user.name){
      user = new User({
        id:user.id,
        name:user.name,
        sex:user.sex == 0 ? 0 : user.sex ? user.sex : -1
      })
    }
    if(this.users.indexOf(user) === -1){
      this.users.push(user)
    }
  }
  registerUserAndSave(user){
    this.registerUser(user);
    return this.saveData().then(({users})=>users)
  }

  modifyUser(userId,userData){
    let user = this.users.find(u=>u.id == userId);
    if( !userData.id || user.id == userData.id ||(user.id !== userData.id && !this.hasExistUser(userData.id))){
      let key = this.getKey(user);
      const color = this.hasChoosed[key];
      delete this.hasChoosed[key];
      user.modify(userData);
      this.hasChoosed[this.getKey(user)] = color;
      return this.saveData().then(({users})=>users);
    }
    return this.getData().then(({users})=>users)
  }

  removeUser(ids){
    let users = this.users.filter(u=>ids.indexOf(u.id)>-1);
    if(users.length){
      this.users = this.users.filter(u=>ids.indexOf(u.id)==-1);
      users.forEach(this.removeFromPrizeResult.bind(this));
      return this.saveData().then(({users})=>users);
    }
    return this.getData().then(({users})=>users)
  }

  hasExistUser(id){
    return this.users.some(user=>user.id==id)
  }

  registerPrize(prize){
    if(!(prize instanceof Prize) && typeof prize == 'object'){
      prize = new Prize(prize)
    }
    if(prize instanceof Prize && this.prizes.indexOf(prize) === -1){
      this.prizes.push(prize)
    }
  }
  registerPrizeAndSave(prize){
    this.registerPrize(prize);
    return this.saveData().then(({prizes})=>prizes)
  }
  modifyPrize(prizeId,prizeData){
    let prize = this.prizes.find(p=>p.id==prizeId)
    if( !!prize && (!prizeData.id || prize.id == prizeData.id ||(prize.id !== prizeData.id && !this.hasExistPrize(prizeData.id)))){
      prize.modify(prizeData);
      this.computedChoosed();
      return this.saveData().then(({prizes})=>prizes);
    }
    return this.getData().then(({prizes})=>prizes)
  }
  
  hasExistPrize(id){
    return this.prizes.some(prize=>prize.id==id)
  }

  removePrize(prizeId){
    const prizes = this.prizes.filter(p=>p.id!==prizeId);
    if(prizes.length !== this.prizes.length){
      this.prizes = prizes;
      this.computedChoosed();
      return this.saveData().then(({prizes})=>prizes)
    }
    return this.getData().then(({prizes})=>prizes)
  }

  removeFromPrizeResult(user){
    let key = this.getKey(user);
    if(this.hasChoosed[key]){
      delete this.hasChoosed[key] 
      this.prizes.forEach(p=>{
        let index = p.result.indexOf(user);
        if(index>-1){
          p.result.splice(index,1)
        }
      })
    }
  }
  mockUsers(){
    let result = [];
    const firstNames = ["赵","钱","孙","李","周","吴","郑","王","冯","陈","褚","卫","蒋","沈","韩","杨","朱","秦","尤","许","何","吕","施","张","孔","曹","严","华","金","魏","陶","姜","戚","谢","邹","喻","柏","水","窦","章","云","苏","潘","葛","奚","范","彭","郎","鲁","韦","昌","马","苗","凤","花","方","俞","任","袁","柳","酆","鲍","史","唐","费","廉","岑","薛","雷","贺","倪","汤","滕","殷","罗","毕","郝","邬","安","常","乐","于","时","傅","皮","卞","齐","康","伍","余","元","卜","顾","孟","平","黄","和","穆","萧","尹","姚","邵","湛","汪","祁","毛","禹","狄","米","贝","明","臧","计","伏","成","戴","谈","宋","茅","庞","熊","纪","舒","屈","项","祝","董","梁","杜","阮","蓝","闵","席","季","麻","强","贾","路","娄","危","江","童","颜","郭","梅","盛","林","刁","钟","徐","邱","骆","高","夏","蔡","田","樊","胡","凌","霍","虞","万","支","柯","昝","管","卢","莫","柯","房","裘","缪","干","解","应","宗","丁","宣","贲","邓","郁","单","杭","洪","包","诸","左","石","崔","吉","钮","龚","程","嵇","邢","滑","裴","陆","荣","翁","荀","羊","于","惠","甄","曲","家","封","芮","羿","储","靳","汲","邴","糜","松","井","段","富","巫","乌","焦","巴","弓","牧","隗","山","谷","车","侯","宓","蓬","全","郗","班","仰","秋","仲","伊","宫","宁","仇","栾","暴","甘","钭","历","戎","祖","武","符","刘","景","詹","束","龙","叶","幸","司","韶","郜","黎","蓟","溥","印","宿","白","怀","蒲","邰","从","鄂","索","咸","籍","赖","卓","蔺","屠","蒙","池","乔","阳","郁","胥","能","苍","双","闻","莘","党","翟","谭","贡","劳","逄","姬","申","扶","堵","冉","宰","郦","雍","却","璩","桑","桂","濮","牛","寿","通","边","扈","燕","冀","浦","尚","农","温","别","庄","晏","柴","瞿","阎","充","慕","连","茹","习","宦","艾","鱼","容","向","古","易","慎","戈","廖","庾","终","暨","居","衡","步","都","耿","满","弘","匡","国","文","寇","广","禄","阙","东","欧","殳","沃","利","蔚","越","夔","隆","师","巩","厍","聂","晁","勾","敖","融","冷","訾","辛","阚","那","简","饶","空","曾","毋","沙","乜","养","鞠","须","丰","巢","关","蒯","相","查","后","荆","红","游","竺","权","逮","盍","益","桓","公","欧阳", "太史", "端木", "上官", "司马", "东方", "独孤", "南宫", "万俟", "闻人", "夏侯", "诸葛", "尉迟", "公羊", "赫连", "澹台", "皇甫", "宗政", "濮阳", "公冶", "太叔", "申屠", "公孙", "慕容", "仲孙", "钟离", "长孙", "宇文", "司徒", "鲜于", "司空", "闾丘", "子车", "亓官", "司寇", "巫马", "公西", "颛孙", "壤驷", "公良", "漆雕", "乐正", "宰父", "谷梁", "拓跋", "夹谷", "轩辕", "令狐", "段干", "百里", "呼延", "东郭", "南门", "羊舌", "微生", "公户", "公玉", "公仪", "梁丘", "公仲", "公上", "公门", "公山", "公坚", "左丘", "公伯", "西门", "公祖", "第五", "公乘", "贯丘", "公皙", "南荣", "东里", "东宫", "仲长", "子书", "子桑", "即墨", "达奚", "褚师", "吴铭"];
    const secondNames = ["雪松","雨华","鹏举","正信","俊楠","明朗","弘亮","宏盛","明志","涵亮","智敏","嘉致","弘量","翔宇","鸿禧","鸿羲","英朗","阳荣","弘益","文昊","飞掣","嘉瑞","咏思","斌蔚","鸿羽","宏大","宏朗","丰茂","俊明","祺然","光赫","志业","乐安","丰羽","祺福","浩气","明煦","俊雅","德海","承运","英勋","德馨","成益","明德","瀚漠","正青","宏爽","经纶","睿慈","良才","阳德","正谊","元基","兴怀","楷瑞","嘉誉","文博","绍辉","修然","子昂","志诚","元良","华茂","凯唱","康安","锐翰","安怡","高远","成仁","明达","康伯","天干","星光","浩思","英华","奇胜","文彬","睿诚","宏富","嘉容","浩轩","昊强","阳煦","子真","振国","信然","天磊","毅然","乐逸","正志","雅逸","烨华","德润","鸿振","乐心","意蕴","欣悦","浩旷","黎明","星纬","凯乐","星火","弘新","德本","国源","良翰","正平","子默","宏恺","嘉慕","志泽","向阳","承望","致远","兴修","文敏","永宁","俊才","和正","苑杰","凯凯","兴腾","开济","奇略","文斌","伟祺","建元","英博","宏逸","飞昂","新翰","锐藻","奇水","文栋","修远","博远","元亮","烨烨","和畅","志文","鸿运","温纶","乐志","高洁","英范","安康","飞跃","德辉","睿聪","经国","项明","华荣","良材","乐山","永昌","雅健","飞英","永安","温文","俊茂","意致","康平","建安","乐欣","高格","飞尘","元恺","泰清","星驰","星津","华采","璞瑜","乐成","阳舒","伟才","锐泽","睿识","鸿卓","良俊","宏放","建中","向荣","修永","伟博","子琪","华灿","弘阔","高丽","学文","飞捷","玉韵","彭彭","翰音","翰翮","修筠","德庸","翰池","宾实","英毅","玉龙","俊爽","高阳","煜祺","成和","鸿熙","浩慨","鸿达","文翰","荣轩","俊喆","承悦","子民","景同","明远","恺乐","温韦","建业","自怡","鹏池","承恩","伟晔","奇文","英发","阳波","和平","光耀","玉轩","伟志","飞文","俊逸","良奥","博艺","锐利","鸿雪","元纬","博裕","明知","国安","朋义","坚成","才英","志行","浩博","祺瑞","力夫","康复","子安","弘深","康健","志新","逸春","阳夏","朋兴","雅畅","弘伟","子骞","昊乾","昊昊","睿好","景曜","弘懿","元凯","涵畅","文山","俊材","波鸿","永福","俊豪","正德","乐贤","斯年","金鑫","涵煦","波峻","心思","俊哲","成济","学博","宏才","和泽","志学","承福","学民","成文","浩邈","昊空","锐达","永逸","理群","宇寰","高义","景铄","巍然","明哲","志勇","永春","承德","明轩","凯安","成业","华皓","宏畅","修齐","哲瀚","德运","德惠","宏峻","乐音","新霁","鹏鲲","星文","修贤","修为","鸿朗","伟茂","晟睿","鹏鲸","博超","涵涵","高畅","嘉赐","乐和","哲彦","景明","鸿飞","辰逸","子墨","承业","鹏翼","敏叡","凯旋","晗日","天禄","景福","欣怿","乐咏","高爽","康成","智宸","晓啸","涵蓄","兴生","温瑜","高兴","星辰","永寿","熠彤","鸿晖","兴思","天睿","元嘉","和豫","泽宇","文柏","高昂","晋鹏","修能","经略","景龙","彭祖","玉树","正奇","咏歌","明诚","宏壮","俊楚","同化","元化","越泽","凯复","元德","俊达","华奥","理全","立群","昊英","烨熠","飞航","天宇","高韵","语堂","宏伟","学义","向明","高岑","鹏天","浦泽","阳晖","英韶","烨梁","嘉祥","昂然","鸿文","德元","俊人","鸿波","炎彬","和同","学海","乐湛","乐康","乐悦","经武","雅昶","文轩","宏义","英睿","锐阵","学林","和韵","星河","高轩","开朗","宇达","鹏煊","飞语","弘济","茂勋","坚诚","璞玉","建修","炫明","华容","奇邃","光亮","景澄","承泽","文耀","向笛","英耀","翰墨","弘和","泰初","良吉","修竹","才俊","雨石","阳焱","承嗣","嘉茂","景焕","永长","正浩","景山","勇毅","俊悟","嘉庆","正阳","宏扬","弘博","华美","博涛","学真","英纵","煜城","安歌","元武","阳辉","凯风","昊苍","泰和","逸仙","子实","子平","建同","博厚","浦和","文乐","博涉","嘉懿","曾琪","康德","高澹","良弼","修伟","思远","景辉","兴言","嘉珍","英喆","鹏程","信鸥","文华","俊能","敏博","高谊","乐家","自强","聪健","永康","康泰","欣然","德宇","斌斌","英卓","星剑","承颜","成化","浩浩","建华","浩淼","昊穹","宜年","欣怡","德华","安翔","自明","玉成","俊远","泽洋","天逸","凯歌","英悟","茂德","和志","高飞","嘉纳","浩瀚","翰海","天纵","博学","飞鸾","文石","修文","元正","明亮","智勇","嘉平","俊力","咏德","良工","博容","敏达","嘉祯","阳伯","康适","弘厚","永思","瀚玥","安邦","弘盛","彭湃","嘉运","天和","俊英","昊焱","开诚","信瑞","哲茂","子轩","明杰","和颂","锐立","良骏","逸明","元思","康盛","温茂","同甫","承志","正豪","君昊","烨霖","宏胜","宜民","良策","俊德","子晋","文曜","晗昱","天成","俊杰","开宇","黎昕","星晖","力言","天瑞","德明","宾鸿","鸿煊","嘉泽","睿范","嘉荣","高驰","建章","康顺","文瑞","良朋","琪睿","子明","翰采","阳秋","思源","英武","子濯","鸿祯","博文","玉书","奇迈","蕴藉","开霁","彬彬","茂彦","宜人","浩广","伟诚","宏博","和惬","雅惠","翰学","鸿远","永言","博实","高明","和光","良平","俊良","弘雅","华藏","英奕","乐游","昊然","天骄","阳飇","明俊","弘壮","彬郁","元勋","鸿信","坚壁","星阑","德泽","光辉","正真","嘉熙","宏毅","奇正","翰林","承平","睿明","巍昂","经亘","智志","雨星","鸿彩","文赋","德容","雨信","才良","博易","泰然","光远","修杰","安平","俊语","和通","宜修","元忠","锐进","泰河","雪风","伟彦","烨烁","嘉佑","英锐","和洽","成弘","苑博","和硕","嘉谊","和雅","永元","建树","涵涤","高峰","弘义","季同","俊智","鸿才","建德","嘉玉","文光","宏浚","兴德","承宣","博延","建弼","安澜","英逸","雅志","康时","浩宕","德佑","自珍","志专","成周","嘉年","文宣","鸿志","天路","冠玉","心远","文星","文林","睿达","雅懿","宏阔","英豪","鸿云","鹏鹍","俊美","英叡","博达","宏硕","泰宁","意远","浩涆","升荣","哲圣","成荫","康乐","锐智","康胜","浩宇","展鹏","嘉福","思淼","鸿福","嘉澍","乐生","景胜","德曜","涵映","心水","勇男","庆生","茂典","思博","高超","涵衍","和风","俊郎","锐精","天工","阳朔","鹏赋","晓博","光霁","建白","安然","高懿","力学","乐章","欣德","修明","浩漫","嘉许","嘉颖","经赋","阳华","乐圣","宏深","星洲","涵育","德业","元龙","兴发","经业","雪峰","经纬","阳泽","博赡","和悌","烨然","承安","乐天","奇逸","弘大","嘉言","瀚海","宏达","元青","兴国","鑫鹏","志国","凯康","浩荡","正诚","彭魄","玉宸","良骥","高芬","浩初","高雅","飞飙","立果","奇志","天材","宇航","浩波","元洲","华池","高寒","永年","修雅","峻熙","高翰","旭尧","志尚","浩阔","凯泽","阳州","承弼","高旻","彬炳","飞扬","成天","弘扬","华清","玉泽","和玉","明智","敏才","宏邈","天韵","飞翔","子瑜","文康","高杰","博雅","正雅","濮存","飞鸿","飞章","飞驰","鑫磊","高歌","季萌","绍元","新荣","嘉德","斯伯","温书","向文","伟懋","俊贤","玉泉","才哲","英哲","文彦","坚白","和昶","翔飞","新觉","兴学","敏学","正业","飞白","承允","涵润","兴昌","和裕","泽语","兴安","鹏海","力强","光誉","伟泽","星宇","鸿光","才捷","高峻","文成","睿才","俊拔","俊艾","昊焱","雅珺","翰藻","阳冰","智鑫","欣嘉","嘉歆","永贞","安福","阳曦","宜然","嘉勋","烨煜","文德","天华","飞翮","锐锋","乐语","宜春","雨伯","俊雄","和悦","飞鹏","阳嘉","嘉禧","弘业","伟兆","明旭","高达","宏茂","坚秉","风华","靖琪","新知","浩歌","伟毅","兴贤","敏智","鸿宝","宏伯","恺歌","俊名","阳曜","浩渺","国豪","康宁","永望","乐童","立人","凯捷","经艺","永新","和煦","嘉志","茂实","远航","才艺","宾白","欣荣","滨海","嘉木","弘毅","英彦","刚洁","嘉良","正卿","飞宇","元白","兴文","鸿哲","修真","巍奕","宇荫","阳羽","宏远","涵容","思聪","建木","绍祺","浩言","智明","鸿轩","俊捷","康裕","安国","俊侠","高卓","兴邦","玉堂","项禹","同和","天赋","承基","锐志","高峯","和宜","星渊","鹏云","成双","元驹","咏志","立轩","信厚","英飙","刚毅","学名","永怡","阳平","志用","高逸","兴业","明珠","嘉树","鹏涛","向晨","睿广","志义","安宜","鸿德","烨伟","正初","鸿博","翰飞","修诚","君浩","修德","弘方","勇军","良哲","博瀚","刚捷","弘化","俊风","锐意","俊誉","建明","星海","阳飙","嘉悦","和泰","兴旺","明辉","文滨","德厚","皓轩","德义","懿轩","俊民","建茗","子石","伟奇","乐池","志明","玉山","元明","烨磊","乐邦","安和","鹤轩","溥心","英光","茂学","鸿畅","俊彦","英卫","开畅","博文","建义","永丰","飞沉","和璧","彭越","建柏","安志","德寿","越彬","奇致","嘉石","博简","安宁","元魁","雅达","飞光","弘图","承载","蕴和","智渊","嘉实","玉宇","勇锐","擎宇","浩南","昂雄","志强","勇捷","高朗","阳云","经义","兴朝","英才","飞翼","和怡"]

    function random(len) {
      return Math.round(Math.random()*len)
    }
    if(isDev){
      for(let i = 0;i<200;i++){
        let randomName = firstNames[random(firstNames.length-1)]+secondNames[random(secondNames.length-1)];
        if(result.indexOf(randomName)==-1){
          result.push(randomName);
          this.registerUser({
            id:'No.'+i,
            name:randomName
          })
        }else{
          i--
        }
      }
    }else{
      this.users = [];
    }
  }

  mockData(){
    this.mockUsers();
    this.mockPrizes();
    return this.saveData()
  }

  saveData(){
    return this.dataSaveService.writeData({
      users:this.users.map(u=>u.value),
      prizes:this.prizes.map(p=>p.value),
      nextUID:User._id,
      nextPID:Prize._id
    })
  }
  getData(){
    return this.dataSaveService.readData()
  }

  doLottery(prizeId,count){
    const _this = this;
    const currentPrize = this.prizes.find(p=>p.id==prizeId);
    // const lotteryLen = currentPrize.total-currentPrize.result.length;
    // const resLen = count > lotteryLen ? lotteryLen : count;
    var ret = this.users
        .filter(function(m, index){
          m.index = index;
          return !_this.hasChoosed[_this.getKey(m)];
        })
        .map(function(m){
          m.score = _this.getRandom();
          return m
        })
        .sort(function(a, b){
          return a.score - b.score;
        })
        .slice(0, count)
        .map(function(m){
          _this.hasChoosed[_this.getKey(m)] = currentPrize.color;
          currentPrize.draw(m);
          return m.value
        });
    return ret.length ? this.saveData().then(({prizes})=>({prizes,result:ret})) : Promise.resolve({result:[]})
  }

  getRandom(){
    let r;
    while(!r || r==1){
      r = Math.random();
    }
    return r
  }

  reset(){
    if(confirm('确定要重置么？所有之前的抽奖历史将被清除！')){
      this.mockData();
      location.reload(true);
    }
  }
}

exports.fsDataService = fsDataService
exports.LotteryService = LotteryService
