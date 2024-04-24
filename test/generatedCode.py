
import torchvision

import torchvision.transforms

import torchvision.datasets

import torch.nn

import torch.nn.functional

class MyModel(torch.nn.Module):
    def __init__(self):
        super().__init__()
        self.node1 = torch.nn.Conv2d(in_channels=123,out_channels=456,kernel_size=(1,1))
        self.node2 = torch.nn.Conv2d(in_channels=789,out_channels=101)
        self.node3 = torch.nn.Tanh()
    def forward(self, x):
        y = self.node1(input=x)
        z = self.node2(input=y)
        a = self.node3(input=z)
        return a

class MyLoss(torch.nn.Module):
    def __init__(self):
        super().__init__()
    def forward(self, x, y):
        return torch.nn.functional.cross_entropy(input=x,target=y)

class Training():
    def __init__(self):
        self.dataset = torchvision.datasets.FlyingThings3D(root="../data",pass_name="clean",transforms=(torchvision.transforms.Resize((256, 256)), torchvision.transforms.ToTensor()))
        self.model = MyModel()
        self.lossFunction = MyLoss()
    def train(self):
        optimizer = torch.nn.Adam()
        dataloader = torch.utils.data.DataLoader(self.dataset)
        for batch_index, (inputs, targets) in enumerate(dataloader):
            optimizer.zero_grad()
            outputs = self.model(inputs)
            loss = self.lossFunction(outputs, targets)
            loss.backward()
            optimizer.step()
            if batch_index % 100 == 0:
                print(f"Batch: {batch_index}, Training Loss: {loss}")